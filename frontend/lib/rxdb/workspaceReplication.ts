import { replicateRxCollection } from 'rxdb/plugins/replication';
import { fetchWorkspaces, createWorkspace, updateWorkspace } from '@/src/shared/api/sobaApi';
import { getSobaApiBaseUrl } from '@/src/shared/config/runtimeConfig';
import type { RxCollection } from 'rxdb';
import type { WorkspaceItem } from '@/src/types/workspaces';
import { useEffect, useRef } from 'react';
import { useRxDb } from '@/src/app/providers/DbProviders';
import { useKeycloak } from '@/lib/hooks/useKeycloak';

export function setupWorkspaceReplication(collection: RxCollection<WorkspaceItem>, token: string) {
  const replicationState = replicateRxCollection<WorkspaceItem, { updatedAt: string }>({
    collection,
    replicationIdentifier: `workspace-rest-replication`,
    pull: {
      async handler(lastCheckpoint?: { updatedAt: string }) {
        const updatedSince = lastCheckpoint?.updatedAt;
        const response = await fetchWorkspaces(token, updatedSince, 'updatedAt:asc');

        const documents = response.items.map((item) => ({
          ...item,
          _deleted: false,
        }));
        const lastDoc = documents[documents.length - 1];

        const nextCheckpoint = lastDoc
          ? { updatedAt: lastDoc.updatedAt || new Date().toISOString() }
          : lastCheckpoint;

        return {
          documents,
          checkpoint: nextCheckpoint,
        };
      },
    },
    push: {
      async handler(docs) {
        const conflicts = [];
        for (const doc of docs) {
          try {
            const isNew = !doc.assumedMasterState;
            if (isNew) {
              await createWorkspace(token, {
                id: doc.newDocumentState.id,
                name: doc.newDocumentState.name,
                disclaimerAccepted: doc.newDocumentState.disclaimerAccepted,
              });
            } else {
              await updateWorkspace(token, doc.newDocumentState.id, {
                name: doc.newDocumentState.name,
                disclaimerAccepted: doc.newDocumentState.disclaimerAccepted,
              });
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

  const sseUrl = `${getSobaApiBaseUrl()}/workspaces/stream?token=${encodeURIComponent(token)}`;
  const eventSource = new EventSource(sseUrl);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data && data.id) {
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

export function useWorkspaceReplication() {
  const db = useRxDb();
  const { token, authenticated } = useKeycloak();
  const ref = useRef<ReturnType<typeof setupWorkspaceReplication> | null>(null);

  useEffect(() => {
    if (db && authenticated && token && !ref.current) {
      ref.current = setupWorkspaceReplication(db.workspaces, token);
    }
    return () => {
      if (ref.current) {
        ref.current.cancel();
        ref.current = null;
      }
    };
  }, [db, token, authenticated]);
}
