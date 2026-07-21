import { replicateRxCollection } from 'rxdb/plugins/replication';
import { saveSobaFormSubmission, submitSobaFormSubmission } from '@/src/shared/api/sobaApi';
import { getSobaApiBaseUrl } from '@/src/shared/config/runtimeConfig';
import type { RxCollection } from 'rxdb';
import { useEffect, useRef } from 'react';
import { useRxDb } from '@/src/app/providers/DbProviders';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import type { SubmissionDataDocument } from './submissionDataSchema';
import { deepEqual } from '@/src/shared/util/deepEqual';

export function setupSubmissionDataReplication(
  collection: RxCollection<SubmissionDataDocument>,
  token: string,
) {
  const replicationState = replicateRxCollection<SubmissionDataDocument, { updatedAt: string }>({
    collection,
    replicationIdentifier: `submission-data-rest-replication`,
    pull: {
      async handler(lastCheckpoint?: { updatedAt: string }) {
        // Full pull of all submission data isn't supported globally via stream right now.
        // SSE pushes real-time updates directly to us.
        // We just return empty to satisfy the handler, and let SSE / direct fetches drive it.
        return {
          documents: [],
          checkpoint: lastCheckpoint,
        };
      },
    },
    push: {
      async handler(docs) {
        const conflicts = [];
        for (const doc of docs) {
          try {
            const data = doc.newDocumentState.data;
            const submissionId = doc.newDocumentState.id;

            if (!deepEqual(doc.assumedMasterState?.data, data)) {
              if (doc.newDocumentState.isDraft) {
                await saveSobaFormSubmission(token, submissionId, data);
              } else {
                await submitSobaFormSubmission(token, submissionId, data);
              }
            }
          } catch {
            conflicts.push(doc.assumedMasterState || doc.newDocumentState);
          }
        }
        return conflicts;
      },
      batchSize: 1,
    },
  });

  const sseUrl = `${getSobaApiBaseUrl()}/submit/submissions/stream?token=${encodeURIComponent(token)}`;
  const eventSource = new EventSource(sseUrl);

  eventSource.onmessage = async (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload && payload.id && payload.data) {
        // Real-time update from another user! Upsert it into local db.
        // We use insert/update directly since pull handler doesn't stream.
        await collection.upsert({
          id: payload.id,
          data: payload.data,
          updatedAt: payload.updatedAt || new Date().toISOString(),
          isDraft: payload.isDraft !== undefined ? payload.isDraft : true,
        });
      }
    } catch {}
  };

  return {
    replicationState,
    eventSource,
    cancel: () => {
      replicationState.cancel();
      eventSource.close();
    },
  };
}

export function useSubmissionDataReplication() {
  const db = useRxDb();
  const { token, authenticated } = useKeycloak();
  const ref = useRef<ReturnType<typeof setupSubmissionDataReplication> | null>(null);

  useEffect(() => {
    if (db && authenticated && token && !ref.current) {
      ref.current = setupSubmissionDataReplication(db.submissionData, token);
    }
    return () => {
      if (ref.current) {
        ref.current.cancel();
        ref.current = null;
      }
    };
  }, [db, token, authenticated]);
}
