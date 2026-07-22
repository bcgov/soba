import { replicateRxCollection } from 'rxdb/plugins/replication';
import { getSobaSubmissions } from '@/src/shared/api/sobaApiDesign';
import { getSobaApiBaseUrl } from '@/src/shared/config/runtimeConfig';
import type { RxCollection } from 'rxdb';
import type { SubmissionListItem } from '@/src/types/submissions';
import { useEffect, useRef } from 'react';
import { useRxDb } from '@/src/app/providers/DbProviders';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useAppSelector } from '@/lib/store';

export function setupSubmissionReplication(
  collection: RxCollection<SubmissionListItem>,
  token: string,
  workspaceId: string,
) {
  const replicationState = replicateRxCollection<SubmissionListItem, { updatedAt: string }>({
    collection,
    replicationIdentifier: `submission-rest-replication-${workspaceId}`,
    pull: {
      async handler(lastCheckpoint?: { updatedAt: string }) {
        // Build the cursor for backend pagination if we have a checkpoint
        let cursorStr = undefined;
        if (lastCheckpoint?.updatedAt) {
          const cursor = { m: 'ts_id', ts: lastCheckpoint.updatedAt };
          cursorStr = Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
        }

        const params: Record<string, string | number> = { sort: 'updatedAt:asc', limit: 100 };
        if (cursorStr) {
          params.cursor = cursorStr;
        }

        const response = await getSobaSubmissions(token, params, workspaceId);

        const documents = response.items.map((item) => ({
          ...item,
          _deleted: false,
        }));

        const lastDoc = documents.at(documents.length - 1);
        const nextCheckpoint = lastDoc
          ? { updatedAt: lastDoc.updatedAt || new Date().toISOString(), id: lastDoc.id }
          : lastCheckpoint;

        return {
          documents,
          checkpoint: nextCheckpoint,
        };
      },
    },
    // No push replication for the list items themselves; submissions are created via forms
    // and updated via separate endpoints or the submissionDataReplication.
  });

  const sseUrl = `${getSobaApiBaseUrl()}/design/submissions/stream?token=${encodeURIComponent(token)}`;
  const eventSource = new EventSource(sseUrl);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data?.id) {
        replicationState.reSync();
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

export function useSubmissionReplication() {
  const db = useRxDb();
  const { token, authenticated } = useKeycloak();
  const { activeWorkspaceId } = useAppSelector((state) => state.workspace);
  const ref = useRef<ReturnType<typeof setupSubmissionReplication> | null>(null);

  useEffect(() => {
    if (db && authenticated && token && activeWorkspaceId && !ref.current) {
      ref.current = setupSubmissionReplication(db.submissions, token, activeWorkspaceId);
    }
    return () => {
      if (ref.current) {
        ref.current.cancel();
        ref.current = null;
      }
    };
  }, [db, token, authenticated, activeWorkspaceId]);
}
