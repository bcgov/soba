/** Result of a document-generation readiness check; exposes no config or credentials. */
export interface DocumentGenerationReadinessResult {
  ok: boolean;
  message?: string;
}

/** A rendered document returned by the generation backend. */
export interface DocumentRenderResult {
  data: Buffer;
  contentType?: string;
}

export interface DocumentGenerationAdapter {
  /**
   * Render a document from a backend-specific payload and return the raw bytes.
   * The payload shape is defined by the selected backend, not by this contract.
   */
  render(payload: Record<string, unknown>): Promise<DocumentRenderResult>;
  /** Optional: report whether the backend is reachable (readiness). No config in the result. */
  readinessCheck?(): Promise<DocumentGenerationReadinessResult>;
}
