import { NativeConnection, Runtime, Worker } from '@temporalio/worker';
import { env } from '../core/config/env';
import { log } from '../core/logging';
import * as activities from './activities';
import { createTemporalPinoLogger } from './temporalPinoLogger';

const workerLog = log.child({ component: 'temporal-worker' });

export async function run() {
  if (!env.getTemporalAllowed()) {
    workerLog.info(
      'Temporal worker not starting (TEMPORAL_ALLOWED is not true); set TEMPORAL_ALLOWED=true to connect',
    );
    return;
  }

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

    workerLog.info('Worker started, polling for tasks');
    try {
      await worker.run();
    } finally {
      process.off('SIGINT', onShutdownSignal);
      process.off('SIGTERM', onShutdownSignal);
    }
  } finally {
    workerLog.info('Worker shut down, closing connection');
    await connection.close();
  }
}
