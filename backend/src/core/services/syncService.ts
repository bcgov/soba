import { FormEngineAdapter } from '../integrations/form-engine/FormEngineAdapter';

interface OutboxItem {
  id: string;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  workspaceId: string;
  payload: unknown;
}

export interface SyncServiceDeps {
  updateFormVersionDraft: (
    workspaceId: string,
    formVersionId: string,
    actorId: string,
    patch: Partial<{
      state: string;
      engineSchemaRef: string;
      engineSyncStatus: string;
      engineSyncError: string | null;
    }>,
  ) => Promise<unknown>;
  updateSubmissionDraft: (
    workspaceId: string,
    submissionId: string,
    actorId: string,
    patch: Partial<{
      workflowState: string;
      engineSubmissionRef: string;
      engineSyncStatus: string;
      engineSyncError: string | null;
      submittedBy: string;
      submittedAt: Date;
    }>,
  ) => Promise<unknown>;
  getFormVersionById: (
    workspaceId: string,
    formVersionId: string,
  ) => Promise<{ formId: string } | null>;
  getSubmissionById: (
    workspaceId: string,
    submissionId: string,
  ) => Promise<{ formId: string } | null>;
  getFormEngineCodeForForm: (workspaceId: string, formId: string) => Promise<string | null>;
}

export class SyncService {
  constructor(
    private readonly createAdapter: (engineCode: string) => FormEngineAdapter,
    private readonly deps: SyncServiceDeps,
    private readonly systemActorId?: string,
  ) {}

  private async resolveEngineCode(item: OutboxItem): Promise<string> {
    const payload =
      typeof item.payload === 'object' && item.payload !== null
        ? (item.payload as Record<string, unknown>)
        : {};
    const payloadEngineCode = payload.engineCode;
    if (typeof payloadEngineCode === 'string' && payloadEngineCode.trim().length > 0) {
      return payloadEngineCode;
    }

    if (item.aggregateType === 'form_version') {
      const formVersion = await this.deps.getFormVersionById(item.workspaceId, item.aggregateId);
      if (!formVersion) {
        throw new Error(`Form version not found for aggregate id '${item.aggregateId}'`);
      }
      const engineCode = await this.deps.getFormEngineCodeForForm(item.workspaceId, formVersion.formId);
      if (!engineCode) {
        throw new Error(`Form engine not found for form '${formVersion.formId}'`);
      }
      return engineCode;
    }

    if (item.aggregateType === 'submission') {
      const submission = await this.deps.getSubmissionById(item.workspaceId, item.aggregateId);
      if (!submission) {
        throw new Error(`Submission not found for aggregate id '${item.aggregateId}'`);
      }
      const engineCode = await this.deps.getFormEngineCodeForForm(item.workspaceId, submission.formId);
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
      throw new Error('SYSTEM_SOBA_USER_ID is required for worker sync updates');
    }
    const engineCode = await this.resolveEngineCode(item);
    const formEngineAdapter = this.createAdapter(engineCode);

    if (item.aggregateType === 'form_version') {
      await this.deps.updateFormVersionDraft(item.workspaceId, item.aggregateId, actorId, {
        engineSyncStatus: 'provisioning',
        engineSyncError: null,
      });
      const response = await formEngineAdapter.createFormVersionSchema({
        formVersionId: item.aggregateId,
        workspaceId: item.workspaceId,
        formId: '',
      });
      await this.deps.updateFormVersionDraft(item.workspaceId, item.aggregateId, actorId, {
        engineSchemaRef: response.engineRef,
        engineSyncStatus: 'ready',
        engineSyncError: null,
      });
      return;
    }

    if (item.aggregateType === 'submission') {
      await this.deps.updateSubmissionDraft(item.workspaceId, item.aggregateId, actorId, {
        engineSyncStatus: 'provisioning',
        engineSyncError: null,
      });
      const response = await formEngineAdapter.createSubmissionRecord({
        submissionId: item.aggregateId,
        workspaceId: item.workspaceId,
        formVersionId: '',
      });
      await this.deps.updateSubmissionDraft(item.workspaceId, item.aggregateId, actorId, {
        engineSubmissionRef: response.engineRef,
        engineSyncStatus: 'ready',
        engineSyncError: null,
      });
      return;
    }

    throw new Error(`Unsupported aggregate type: ${item.aggregateType}`);
  }
}
