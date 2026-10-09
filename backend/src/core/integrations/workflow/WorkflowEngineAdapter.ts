/** Result of a workflow engine readiness check; no config or credentials are exposed. */
export interface WorkflowEngineReadinessResult {
  ok: boolean;
  message?: string;
}

export interface Workflow {
  id: string;
}

/** Result of a workflow engine readiness check; no config or credentials are exposed. */
export interface GetWorkflowsResult {
  workflows: Array<Workflow>;
}

export interface WorkflowEngineAdapter {
  readinessCheck?(): Promise<WorkflowEngineReadinessResult>;
  getWorkflows?(): Promise<GetWorkflowsResult>;
  getWorkflow?(workflowId: string): Promise<Workflow>;
  startWorkflow?(workflowId: string, payload: unknown): Promise<boolean>;
}
