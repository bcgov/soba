import { Worker, NativeConnection } from '@temporalio/worker';
import { env } from '../core/config/env';
import * as activities from './activities';

export async function run() {
  const address = env.getTemporalAddress();
  const namespace = env.getTemporalNamespace();
  const taskQueue = env.getTemporalTaskQueue();

  console.log(
    `[temporal-worker] Connecting to ${address} (namespace: ${namespace}, queue: ${taskQueue})`,
  );

  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue,
    namespace,
  });

  console.log('[temporal-worker] Worker started, polling for tasks');
  await worker.run();

  console.log('[temporal-worker] Worker shut down, closing connection');
  await connection.close();
}
