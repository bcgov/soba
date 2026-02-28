import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';
import { db } from '../client';
import { integrationOutbox } from '../schema';
import { QueueEvent } from '../../integrations/queue/QueueAdapter';

export const enqueueOutboxEvent = async (event: QueueEvent) => {
  await db.insert(integrationOutbox).values({
    topic: event.topic,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    workspaceId: event.workspaceId,
    payload: event.payload,
    status: 'pending',
    createdBy: event.actorId ?? null,
    updatedBy: event.actorId ?? null,
  });
};

export const claimOutboxBatch = async (batchSize = 20) => {
  const pending = await db
    .select()
    .from(integrationOutbox)
    .where(
      and(
        eq(integrationOutbox.status, 'pending'),
        or(
          lte(integrationOutbox.nextAttemptAt, new Date()),
          isNull(integrationOutbox.nextAttemptAt),
        ),
      ),
    )
    .orderBy(asc(integrationOutbox.createdAt))
    .limit(batchSize);

  if (pending.length === 0) {
    return [];
  }

  const claimed: typeof pending = [];
  for (const item of pending) {
    const updated = await db
      .update(integrationOutbox)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(and(eq(integrationOutbox.id, item.id), eq(integrationOutbox.status, 'pending')))
      .returning();

    if (updated[0]) {
      claimed.push(updated[0]);
    }
  }

  return claimed;
};

export const markOutboxSucceeded = async (id: string, actorId?: string) => {
  await db
    .update(integrationOutbox)
    .set({ status: 'done', updatedAt: new Date(), updatedBy: actorId ?? null, lastError: null })
    .where(eq(integrationOutbox.id, id));
};

export const markOutboxFailed = async (
  id: string,
  actorId: string | undefined,
  errorMessage: string,
  attemptCount: number,
) => {
  const nextAttempt = new Date(Date.now() + Math.min(60_000 * (attemptCount + 1), 10 * 60_000));

  await db
    .update(integrationOutbox)
    .set({
      status: 'pending',
      attemptCount: attemptCount + 1,
      nextAttemptAt: nextAttempt,
      lastError: errorMessage.slice(0, 1000),
      updatedBy: actorId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(integrationOutbox.id, id));
};
