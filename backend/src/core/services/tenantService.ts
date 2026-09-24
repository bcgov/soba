import { env } from '../config/env';
import {
  createTenantEngineAdapter,
  getTenantEnginePlugins,
  resolveTenantEnginePlugin,
} from '../integrations/tenant/TenantEngineRegistry';
import { ValidationError } from '../errors';

export interface ListInput {
  userId: string;
  token: string;
  tenantEngineCode?: string;
}

export interface HealthInput {
  tenantEngineCode?: string;
}

export const getTenantEngineCode = (input) => {
  const plugins = getTenantEnginePlugins();
  if (plugins.length === 0) {
    throw new ValidationError('No tenant engine plugins installed.');
  }
  const defaultCode =
    env.getTenantEngineDefaultCode() ??
    (plugins.some((p) => p.code === 'cstar-v1') ? 'cstar-v1' : plugins[0].code);

  const engineCode = input.tenantEngineCode ?? defaultCode;

  const installed = plugins.some((p) => p.code === engineCode);
  if (!installed) {
    throw new ValidationError(
      input.tenantEngineCode
        ? `Tenant engine '${input.tenantEngineCode}' is not installed`
        : `Default tenant engine '${defaultCode}' is not installed`,
    );
  }
  return engineCode;
};

export const resolveTenantEngine = (input) => {
  const engineCode = getTenantEngineCode(input);

  return resolveTenantEnginePlugin(engineCode);
};

export class TenantService {
  async list(input: ListInput) {
    const engineCode = getTenantEngineCode(input);
    resolveTenantEngine(input);
    const adapter = createTenantEngineAdapter(engineCode);
    return await adapter.getTenants(input);
  }

  async health(input: HealthInput) {
    const engineCode = getTenantEngineCode(input);
    resolveTenantEngine(input);
    const adapter = createTenantEngineAdapter(engineCode);
    return await adapter.readinessCheck();
  }
}
