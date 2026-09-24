import { TenantService, getTenantEngineCode } from '../../../src/core/services/tenantService';
import { env } from '../../../src/core/config/env';
import * as tenantEngineRegistry from '../../../src/core/integrations/tenant/TenantEngineRegistry';
import { ValidationError } from '../../../src/core/errors';

jest.mock('../../../src/core/config/env');
jest.mock('../../../src/core/integrations/tenant/TenantEngineRegistry');

describe('TenantService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('getTenantEngineCode throws when no plugins installed', () => {
    jest.mocked(tenantEngineRegistry.getTenantEnginePlugins).mockReturnValue([]);
    expect(() => getTenantEngineCode({})).toThrow(ValidationError);
    expect(() => getTenantEngineCode({})).toThrow('No tenant engine plugins installed.');
  });

  it('getTenantEngineCode returns provided code if installed', () => {
    jest
      .mocked(tenantEngineRegistry.getTenantEnginePlugins)
      .mockReturnValue([{ code: 'test-engine', name: 'Test' }]);
    expect(getTenantEngineCode({ tenantEngineCode: 'test-engine' })).toBe('test-engine');
  });

  it('getTenantEngineCode throws if provided code is not installed', () => {
    jest
      .mocked(tenantEngineRegistry.getTenantEnginePlugins)
      .mockReturnValue([{ code: 'other-engine', name: 'Other' }]);
    expect(() => getTenantEngineCode({ tenantEngineCode: 'test-engine' })).toThrow(ValidationError);
  });

  it('getTenantEngineCode uses default code from env if not provided', () => {
    jest
      .mocked(tenantEngineRegistry.getTenantEnginePlugins)
      .mockReturnValue([{ code: 'default-env-engine', name: 'Default' }]);
    jest.mocked(env.getTenantEngineDefaultCode).mockReturnValue('default-env-engine');
    expect(getTenantEngineCode({})).toBe('default-env-engine');
  });

  it('getTenantEngineCode falls back to cstar-v1 or first plugin if env not set and code not provided', () => {
    jest.mocked(env.getTenantEngineDefaultCode).mockReturnValue(undefined);
    jest.mocked(tenantEngineRegistry.getTenantEnginePlugins).mockReturnValue([
      { code: 'first-engine', name: 'First' },
      { code: 'cstar-v1', name: 'Cstar' },
    ]);
    expect(getTenantEngineCode({})).toBe('cstar-v1');

    jest
      .mocked(tenantEngineRegistry.getTenantEnginePlugins)
      .mockReturnValue([{ code: 'first-engine', name: 'First' }]);
    expect(getTenantEngineCode({})).toBe('first-engine');
  });
  let mockAdapter: unknown;

  beforeEach(() => {
    mockAdapter = {
      getTenants: jest.fn().mockResolvedValue({ tenants: [] }),
      readinessCheck: jest.fn().mockResolvedValue({ ok: true }),
    };
    jest
      .mocked(tenantEngineRegistry.getTenantEnginePlugins)
      .mockReturnValue([{ code: 'test-engine', name: 'Test' }]);
    jest
      .mocked(tenantEngineRegistry.resolveTenantEnginePlugin)
      .mockReturnValue(
        {} as unknown as import('../../../src/core/integrations/tenant/TenantEnginePluginDefinition').TenantEnginePluginDefinition,
      );
    jest
      .mocked(tenantEngineRegistry.createTenantEngineAdapter)
      .mockReturnValue(
        mockAdapter as import('../../../src/core/integrations/tenant/TenantEngineAdapter').TenantEngineAdapter,
      );
    jest.mocked(env.getTenantEngineDefaultCode).mockReturnValue('test-engine');
  });

  it('list delegates to adapter.getTenants', async () => {
    const service = new TenantService();
    const input = { userId: '123', token: 'abc' };
    const result = await service.list(input);
    expect((mockAdapter as { getTenants: jest.Mock }).getTenants).toHaveBeenCalledWith(input);
    expect(result).toEqual({ tenants: [] });
  });

  it('health delegates to adapter.readinessCheck', async () => {
    const service = new TenantService();
    const input = {};
    const result = await service.health(input);
    expect((mockAdapter as { readinessCheck: jest.Mock }).readinessCheck).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});
