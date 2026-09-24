import { getTenantEnginePlugins } from '../../../../src/core/integrations/tenant/TenantEngineRegistry';
import * as pluginRegistry from '../../../../src/core/integrations/plugins/PluginRegistry';

jest.mock('../../../../src/core/integrations/plugins/PluginRegistry');
jest.mock('../../../../src/core/config/pluginConfig');

describe('TenantEngineRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getTenantEnginePlugins calls catalog', () => {
    jest
      .mocked(pluginRegistry.getTenantEnginePluginCatalog)
      .mockReturnValue([{ code: 'test', name: 'Test' }]);
    expect(getTenantEnginePlugins()).toEqual([{ code: 'test', name: 'Test' }]);
  });

  it('resolveTenantEnginePlugin throws if code not found', async () => {
    await jest.isolateModulesAsync(async () => {
      const { resolveTenantEnginePlugin } =
        await import('../../../../src/core/integrations/tenant/TenantEngineRegistry');
      const pr = await import('../../../../src/core/integrations/plugins/PluginRegistry');
      jest.spyOn(pr, 'getTenantEnginePluginDefinitions').mockReturnValue([]);

      expect(() => resolveTenantEnginePlugin('missing')).toThrow(
        "No tenant engine plugin is installed for code 'missing'",
      );
    });
  });

  it('resolveTenantEnginePlugin returns definition', async () => {
    await jest.isolateModulesAsync(async () => {
      const { resolveTenantEnginePlugin } =
        await import('../../../../src/core/integrations/tenant/TenantEngineRegistry');
      const pr = await import('../../../../src/core/integrations/plugins/PluginRegistry');
      jest.spyOn(pr, 'getTenantEnginePluginDefinitions').mockReturnValue([
        {
          code: 'test',
        } as unknown as import('../../../../src/core/integrations/tenant/TenantEnginePluginDefinition').TenantEnginePluginDefinition,
      ]);

      expect(resolveTenantEnginePlugin('test')).toEqual({ code: 'test' });
    });
  });

  it('createTenantEngineAdapter creates adapter via definition', async () => {
    await jest.isolateModulesAsync(async () => {
      const { createTenantEngineAdapter } =
        await import('../../../../src/core/integrations/tenant/TenantEngineRegistry');
      const pr = await import('../../../../src/core/integrations/plugins/PluginRegistry');
      const pc = await import('../../../../src/core/config/pluginConfig');

      const mockCreateAdapter = jest.fn().mockReturnValue('adapter');
      jest.spyOn(pr, 'getTenantEnginePluginDefinitions').mockReturnValue([
        {
          code: 'test',
          createAdapter: mockCreateAdapter,
        } as unknown as import('../../../../src/core/integrations/tenant/TenantEnginePluginDefinition').TenantEnginePluginDefinition,
      ]);
      jest
        .spyOn(pc, 'createPluginConfigReader')
        .mockReturnValue(
          'config-reader' as unknown as import('../../../../src/core/config/pluginConfig').PluginConfigReader,
        );

      const adapter = createTenantEngineAdapter('test');
      expect(adapter).toBe('adapter');
      expect(mockCreateAdapter).toHaveBeenCalledWith('config-reader');
    });
  });

  it('checkTenantEngineReadiness returns results for all plugins', async () => {
    await jest.isolateModulesAsync(async () => {
      const { checkTenantEngineReadiness } =
        await import('../../../../src/core/integrations/tenant/TenantEngineRegistry');
      const pr = await import('../../../../src/core/integrations/plugins/PluginRegistry');

      jest.spyOn(pr, 'getTenantEnginePluginCatalog').mockReturnValue([
        { code: 'plugin1', name: 'Plugin 1' },
        { code: 'plugin2', name: 'Plugin 2' },
        { code: 'plugin3', name: 'Plugin 3' },
      ]);
      jest.spyOn(pr, 'getTenantEnginePluginDefinitions').mockReturnValue([
        { code: 'plugin1', createAdapter: () => ({ readinessCheck: async () => ({ ok: true }) }) },
        { code: 'plugin2', createAdapter: () => ({}) }, // No readinessCheck
        {
          code: 'plugin3',
          createAdapter: () => ({
            readinessCheck: async () => {
              throw new Error('fail');
            },
          }),
        },
      ] as unknown as import('../../../../src/core/integrations/tenant/TenantEnginePluginDefinition').TenantEnginePluginDefinition[]);

      const results = await checkTenantEngineReadiness();
      expect(results).toEqual({
        plugin1: { ok: true },
        plugin2: { ok: true },
        plugin3: { ok: false, message: 'fail' },
      });
    });
  });
});
