import type { TenantSchema } from '@soba/lib';

/** Result of a form engine readiness check; no config or credentials are exposed. */
export interface TenantEngineReadinessResult {
  ok: boolean;
  message?: string;
}

export interface TenantsResult {
  ok?: boolean;
  tenants?: Array<typeof TenantSchema>;
  message?: string;
}

export interface GetTenantsInput {
  token: string;
  userId: string;
}

export interface TenantEngineAdapter {
  /** Optional: report whether the engine is reachable (readiness). No config in result. */
  readinessCheck?(): Promise<TenantEngineReadinessResult>;
  getTenants(input: GetTenantsInput): Promise<TenantsResult>;
}
