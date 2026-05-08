export interface SubmissionListItem {
  id: string;
  formId: string;
  formName?: string;
  formVersionId: string;
  versionNo?: number;
  workflowState: string;
  engineSyncStatus: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListSubmissionsResponse {
  items: SubmissionListItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    cursorMode: 'id' | 'ts_id';
  };
  filters: {
    formId?: string;
    formVersionId?: string;
    workflowState?: string;
    createdBy?: string;
  };
  sort: string;
}
