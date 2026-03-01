// Must be first: initializes .env + .env.local for this process.
import { env } from '../config/env';
env.loadEnv();

import rTracer from 'cls-rtracer';
import { claimOutboxBatch, markOutboxFailed, markOutboxSucceeded } from '../db/repos/outboxRepo';
import { getSyncService } from '../container';
import { getSystemSobaUserId } from '../services/systemUser';
import { pool } from '../db/client';
import { log } from '../logging';

const POLL_INTERVAL_MS = env.getOutboxPollIntervalMs() ?? 5000;
const BATCH_SIZE = env.getOutboxBatchSize() ?? 25;

const runOnce = async () => {
  const syncService = await getSyncService();
  const systemActorId = await getSystemSobaUserId();

  const batch = await claimOutboxBatch(BATCH_SIZE);
  for (const item of batch) {
    await rTracer.runWithId(async () => {
      try {
        await syncService.process(item);
        await markOutboxSucceeded(item.id, systemActorId);
      } catch (error) {
        await markOutboxFailed(item.id, systemActorId, (error as Error).message, item.attemptCount);
        log.error({ err: error, outboxId: item.id }, 'Outbox item failed');
      }
    }, `outbox-${item.id}`);
  }
};

const loop = async () => {
  while (true) {
    try {
      await runOnce();
    } catch (error) {
      log.error({ err: error }, 'Outbox worker iteration failed');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
};

loop().catch(async (error) => {
  log.error({ err: error }, 'Outbox worker fatal error');
  await pool.end();
  process.exit(1);
});
