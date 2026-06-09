/** Result of a form engine readiness check; no config or credentials are exposed. */
export interface FormEngineReadinessResult {
  ok: boolean;
  message?: string;
}

/** Input for upserting a form schema into the engine; idempotent by form version. */
export interface UpsertSchemaInput {
  /** SOBA form_version id; used to derive the deterministic engine identity. */
  formVersionId: string;
  /** SOBA workspace id; recorded on the engine document for tenancy/filtering. */
  workspaceId: string;
  /** The form definition (Form.io schema JSON) to store. */
  schema: Record<string, unknown>;
  /** Optional human-readable title; defaults to the schema's own title. */
  title?: string;
}

export interface FormEngineAdapter {
  /** Optional: report whether the engine is reachable (readiness). No config in result. */
  readinessCheck?(): Promise<FormEngineReadinessResult>;
  /**
   * Create or update the engine document for a form version, keyed by a deterministic
   * identity derived from `formVersionId`. Idempotent: safe to retry. Returns the engine ref.
   */
  upsertSchema?(input: UpsertSchemaInput): Promise<{ engineRef: string }>;
  /** Read the engine document by ref. Returns null if not found. */
  readSchema?(engineRef: string): Promise<Record<string, unknown> | null>;
  /** Delete the engine document by ref (compensation / cleanup). */
  deleteSchema?(engineRef: string): Promise<void>;
}
