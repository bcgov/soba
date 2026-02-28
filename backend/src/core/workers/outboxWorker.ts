// Must be first: initializes .env + .env.local for this process.
import { env } from '../config/env';
env.loadEnv();

import { claimOutboxBatch, markOutboxFailed, markOutboxSucceeded } from '../db/repos/outboxRepo';
import { createFormEngineAdapter } from '../integrations/form-engine/FormEngineRegistry';
import { SyncService } from '../services/syncService';
import { pool } from '../db/client';
import { getFormEngineCodeForForm } from '../db/repos/formRepo';
import { getFormVersionById, updateFormVersionDraft } from '../db/repos/formVersionRepo';
import { getSubmissionById, updateSubmissionDraft } from '../db/repos/submissionRepo';

const POLL_INTERVAL_MS = env.getOutboxPollIntervalMs();

const runOnce = async () => {
  const systemActorId = env.getSystemSobaUserId();
  const syncService = new SyncService(
    createFormEngineAdapter,
    {
      updateFormVersionDraft,
      updateSubmissionDraft,
      getFormVersionById,
      getSubmissionById,
      getFormEngineCodeForForm,
    },
    systemActorId,
  );

  const batch = await claimOutboxBatch(25);
  for (const item of batch) {
    try {
      await syncService.process(item);
      await markOutboxSucceeded(item.id, systemActorId);
    } catch (error) {
      await markOutboxFailed(item.id, systemActorId, (error as Error).message, item.attemptCount);
    }
  }
};

const loop = async () => {
  while (true) {
    try {
      await runOnce();
    } catch (error) {
      console.error('Outbox worker iteration failed', error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
};

loop().catch(async (error) => {
  console.error('Outbox worker fatal error', error);
  await pool.end();
  process.exit(1);
});
