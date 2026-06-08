/** Result of a form engine readiness check; no config or credentials are exposed. */
export interface FormEngineReadinessResult {
  ok: boolean;
  message?: string;
}

export interface FormEngineAdapter {
  /** Optional: report whether the engine is reachable (readiness). No config in result. */
  readinessCheck?(): Promise<FormEngineReadinessResult>;
}
