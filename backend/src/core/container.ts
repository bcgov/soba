/**
 * Composition root: wires all core services and adapters once at startup.
 * API and worker import from here so the dependency graph is explicit in one place.
 */
import { getCacheAdapter, getMessageBusAdapter } from './integrations/plugins/PluginRegistry';
import { DbOutboxQueueAdapter } from './integrations/queue/dbOutboxQueueAdapter';
import { createFormEngineAdapter } from './integrations/form-engine/FormEngineRegistry';
import { FormService } from './services/formService';
import { FormVersionService } from './services/formVersionService';
import { SubmissionService } from './services/submissionService';
import { SyncService } from './services/syncService';
import { getSystemUser } from './services/systemUser';
import { createFormsApiService } from './api/forms/serviceFactory';
import { createSubmissionsApiService } from './api/submissions/serviceFactory';
import { getFormEngineCodeForForm } from './db/repos/formRepo';
import { getFormVersionById, updateFormVersionDraft } from './db/repos/formVersionRepo';
import { getSubmissionById, updateSubmissionDraft } from './db/repos/submissionRepo';

const messageBus = getMessageBusAdapter();
const queue = new DbOutboxQueueAdapter(messageBus);
const formService = new FormService();
const formVersionService = new FormVersionService(queue);
const submissionService = new SubmissionService(queue);

export const formsApiService = createFormsApiService(formService, formVersionService);
export const submissionsApiService = createSubmissionsApiService(submissionService);

export function getCache(): ReturnType<typeof getCacheAdapter> {
  return getCacheAdapter();
}

let syncServiceInstance: SyncService | null = null;

export async function getSyncService(): Promise<SyncService> {
  if (!syncServiceInstance) {
    const systemUser = await getSystemUser();
    syncServiceInstance = new SyncService(
      createFormEngineAdapter,
      {
        updateFormVersionDraft,
        updateSubmissionDraft,
        getFormVersionById,
        getSubmissionById,
        getFormEngineCodeForForm,
      },
      systemUser?.id,
      systemUser?.displayLabel ?? null,
    );
  }
  return syncServiceInstance;
}
