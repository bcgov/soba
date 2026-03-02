import { FormEngineAdapter } from '../integrations/form-engine/FormEngineAdapter';
import {
  parseFormVersionCreatePayload,
  parseSubmissionCreatePayload,
} from '../integrations/queue/events';
import type { SyncServiceDeps } from './syncServiceTypes';

export type { SyncServiceDeps } from './syncServiceTypes';

interface OutboxItem {
  id: string;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  workspaceId: string;
  payload: unknown;
}

export class SyncService {
  constructor(
    private readonly createAdapter: (engineCode: string) => FormEngineAdapter,
    private readonly deps: SyncServiceDeps,
    private readonly systemActorId?: string,
    private readonly systemActorDisplayLabel: string | null = null,
  ) {}

  private async resolveEngineCode(item: OutboxItem): Promise<string> {
    if (item.aggregateType === 'form_version') {
      try {
        const payload = parseFormVersionCreatePayload(item.payload);
        if (payload.engineCode?.trim()) return payload.engineCode;
      } catch {
        // fall through to DB lookup
      }
      const formVersion = await this.deps.getFormVersionById(item.workspaceId, item.aggregateId);
      if (!formVersion) {
        throw new Error(`Form version not found for aggregate id '${item.aggregateId}'`);
      }
      const engineCode = await this.deps.getFormEngineCodeForForm(
        item.workspaceId,
        formVersion.formId,
      );
      if (!engineCode) {
        throw new Error(`Form engine not found for form '${formVersion.formId}'`);
      }
      return engineCode;
    }

    if (item.aggregateType === 'submission') {
      try {
        const payload = parseSubmissionCreatePayload(item.payload);
        if (payload.engineCode?.trim()) return payload.engineCode;
      } catch {
        // fall through to DB lookup
      }
      const submission = await this.deps.getSubmissionById(item.workspaceId, item.aggregateId);
      if (!submission) {
        throw new Error(`Submission not found for aggregate id '${item.aggregateId}'`);
      }
      const engineCode = await this.deps.getFormEngineCodeForForm(
        item.workspaceId,
        submission.formId,
      );
      if (!engineCode) {
        throw new Error(`Form engine not found for form '${submission.formId}'`);
      }
      return engineCode;
    }

    throw new Error(`Unsupported aggregate type: ${item.aggregateType}`);
  }

  async process(item: OutboxItem): Promise<void> {
    const actorId = this.systemActorId;
    if (!actorId) {
      throw new Error(
        'System user not found (ensure seed has run; SOBA_SYSTEM_SUBJECT defaults to soba-system)',
      );
    }
    const engineCode = await this.resolveEngineCode(item);
    const formEngineAdapter = this.createAdapter(engineCode);

    if (item.aggregateType === 'form_version') {
      const payload = parseFormVersionCreatePayload(item.payload);
      let formId = payload.formId;
      if (!formId) {
        const formVersion = await this.deps.getFormVersionById(item.workspaceId, item.aggregateId);
        formId = formVersion?.formId ?? '';
      }
      await this.deps.updateFormVersionDraft(
        item.workspaceId,
        item.aggregateId,
        this.systemActorDisplayLabel,
        { engineSyncStatus: 'provisioning', engineSyncError: null },
      );
      const response = await formEngineAdapter.createFormVersionSchema({
        formVersionId: item.aggregateId,
        workspaceId: item.workspaceId,
        formId,
      });
      await this.deps.updateFormVersionDraft(
        item.workspaceId,
        item.aggregateId,
        this.systemActorDisplayLabel,
        {
          engineSchemaRef: response.engineRef,
          engineSyncStatus: 'ready',
          engineSyncError: null,
        },
      );
      return;
    }

    if (item.aggregateType === 'submission') {
      const payload = parseSubmissionCreatePayload(item.payload);
      let formVersionId = payload.formVersionId;
      if (!formVersionId) {
        const submission = await this.deps.getSubmissionById(item.workspaceId, item.aggregateId);
        formVersionId = submission?.formVersionId ?? '';
      }
      await this.deps.updateSubmissionDraft(
        item.workspaceId,
        item.aggregateId,
        this.systemActorDisplayLabel,
        { engineSyncStatus: 'provisioning', engineSyncError: null },
      );
      const response = await formEngineAdapter.createSubmissionRecord({
        submissionId: item.aggregateId,
        workspaceId: item.workspaceId,
        formVersionId,
      });
      await this.deps.updateSubmissionDraft(
        item.workspaceId,
        item.aggregateId,
        this.systemActorDisplayLabel,
        {
          engineSubmissionRef: response.engineRef,
          engineSyncStatus: 'ready',
          engineSyncError: null,
        },
      );
      return;
    }

    throw new Error(`Unsupported aggregate type: ${item.aggregateType}`);
  }
}
