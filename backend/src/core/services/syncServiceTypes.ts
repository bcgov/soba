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
  ) => Promise<{ formId: string; formVersionId?: string } | null>;
  getFormEngineCodeForForm: (workspaceId: string, formId: string) => Promise<string | null>;
}
