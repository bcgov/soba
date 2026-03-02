export interface FormVersionProvisionInput {
  formVersionId: string;
  workspaceId: string;
  formId: string;
}

export interface SubmissionProvisionInput {
  submissionId: string;
  workspaceId: string;
  formVersionId: string;
}

export interface FormEngineAdapter {
  createFormVersionSchema(input: FormVersionProvisionInput): Promise<{ engineRef: string }>;
  createSubmissionRecord(input: SubmissionProvisionInput): Promise<{ engineRef: string }>;
}
