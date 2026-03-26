// Must be first: initializes .env + .env.local for this process.
import { env } from '../config/env';
env.loadEnv();

import rTracer from 'cls-rtracer';
import { claimOutboxBatch, markOutboxFailed, markOutboxSucceeded } from '../db/repos/outboxRepo';
import { getSyncService } from '../container';
import { getSystemUser } from '../services/systemUser';
import { pool } from '../db/client';
import { log } from '../logging';

const POLL_INTERVAL_MS = env.getOutboxPollIntervalMs() ?? 5000;
const BATCH_SIZE = env.getOutboxBatchSize() ?? 25;

const runOnce = async () => {
  const started = Date.now();
  const syncService = await getSyncService();
  const systemUser = await getSystemUser();
  const systemDisplayLabel = systemUser?.displayLabel ?? null;

  const batch = await claimOutboxBatch(BATCH_SIZE);
  if (batch.length === 0) {
    log.debug('Outbox worker poll: no pending items');
    return;
  }

  log.info(
    {
      count: batch.length,
      items: batch.map((row) => ({
        id: row.id,
        topic: row.topic,
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
      })),
    },
    'Outbox worker claimed batch',
  );

  for (const item of batch) {
    await rTracer.runWithId(async () => {
      try {
        await syncService.process(item);
        await markOutboxSucceeded(item.id, systemDisplayLabel);
        log.debug(
          { outboxId: item.id, topic: item.topic, aggregateType: item.aggregateType },
          'Outbox item succeeded',
        );
      } catch (error) {
        await markOutboxFailed(
          item.id,
          systemDisplayLabel,
          (error as Error).message,
          item.attemptCount,
        );
        log.error({ err: error, outboxId: item.id }, 'Outbox item failed');
      }
    }, `outbox-${item.id}`);
  }

  log.info(
    { count: batch.length, durationMs: Date.now() - started },
    'Outbox worker batch cycle complete',
  );
};

const loop = async () => {
  log.info({ pollIntervalMs: POLL_INTERVAL_MS, batchSize: BATCH_SIZE }, 'Outbox worker started');
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
