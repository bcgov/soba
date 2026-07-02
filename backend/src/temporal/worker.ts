import * as http from 'node:http';
import { NativeConnection, Runtime, Worker } from '@temporalio/worker';
import { env } from '../core/config/env';
import { log } from '../core/logging';
import * as activities from './activities';
import { createTemporalPinoLogger } from './temporalPinoLogger';

const workerLog = log.child({ component: 'temporal-worker' });

/**
 * Minimal health server so Kubernetes can gate the rollout on the worker actually
 * connecting to Temporal. `/readyz` returns 200 only once the worker is created
 * (connection established) and polling; otherwise 503. `/healthz` reports process
 * liveness. If the worker cannot reach the Temporal frontend, `NativeConnection.connect`
 * throws and the process exits, so the readiness probe never passes and the deploy fails.
 */
function startHealthServer(isReady: () => boolean): http.Server {
  const port = env.getTemporalWorkerHealthPort();
  const server = http.createServer((req, res) => {
    if (req.url === '/readyz') {
      const ready = isReady();
      res.writeHead(ready ? 200 : 503).end(ready ? 'ready' : 'starting');
      return;
    }
    if (req.url === '/healthz') {
      res.writeHead(200).end('ok');
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(port, () => workerLog.info({ port }, 'Worker health server listening'));
  return server;
}

export async function run() {
  if (!env.getTemporalAllowed()) {
    workerLog.info(
      'Temporal worker not starting (TEMPORAL_ALLOWED is not true); set TEMPORAL_ALLOWED=true to connect',
    );
    return;
  }

  let ready = false;
  const healthServer = startHealthServer(() => ready);

  Runtime.install({
    logger: createTemporalPinoLogger(workerLog),
  });

  const address = env.getTemporalAddress();
  const namespace = env.getTemporalNamespace();
  const taskQueue = env.getTemporalTaskQueue();

  workerLog.info({ address, namespace, taskQueue }, 'Connecting to Temporal');

  const connection = await NativeConnection.connect({ address });

  try {
    const worker = await Worker.create({
      connection,
      workflowsPath: require.resolve('./workflows'),
      activities,
      taskQueue,
      namespace,
    });

    let shutdownRequested = false;
    const onShutdownSignal = () => {
      if (shutdownRequested) return;
      shutdownRequested = true;
      workerLog.info('Shutdown signal received, draining worker');
      worker.shutdown();
    };
    process.once('SIGINT', onShutdownSignal);
    process.once('SIGTERM', onShutdownSignal);

    ready = true;
    workerLog.info('Worker started, polling for tasks');
    try {
      await worker.run();
    } finally {
      ready = false;
      process.off('SIGINT', onShutdownSignal);
      process.off('SIGTERM', onShutdownSignal);
    }
  } finally {
    ready = false;
    workerLog.info('Worker shut down, closing connection');
    await connection.close();
    healthServer.close();
  }
}
