export interface FormVersionProvisionInput {
  formVersionId: string;
  workspaceId: string;
  formId: string;
  formioFormDefinition?: Record<string, unknown>;
  formSlug?: string;
  formName?: string;
}

export interface SubmissionProvisionInput {
  submissionId: string;
  workspaceId: string;
  formVersionId: string;
}

/** Result of a form engine readiness check; no config or credentials are exposed. */
export interface FormEngineReadinessResult {
  ok: boolean;
  message?: string;
}

export interface FormEngineAdapter {
  createFormVersionSchema(input: FormVersionProvisionInput): Promise<{ engineRef: string }>;
  createSubmissionRecord(input: SubmissionProvisionInput): Promise<{ engineRef: string }>;
  /** Optional: report whether the engine is reachable (readiness). No config in result. */
  readinessCheck?(): Promise<FormEngineReadinessResult>;
}
