jest.mock('../../../../src/core/integrations/plugins/PluginRegistry', () => ({
  getPluginCatalog: jest.fn(),
  getActivePluginCodes: jest.fn(() => new Set<string>()),
  getActiveStorageBackendCodes: jest.fn(() => new Set<string>()),
  getFeatureGatedPluginCodes: jest.fn(),
}));
jest.mock('../../../../src/core/integrations/form-engine/FormEngineRegistry', () => ({
  getFormEnginePlugins: jest.fn(() => []),
}));
jest.mock('../../../../src/core/db/repos/featureRepo', () => {
  const actual = jest.requireActual('../../../../src/core/db/repos/featureRepo');
  return { ...actual, listFeatures: jest.fn() };
});

import { metaApiService } from '../../../../src/core/api/meta/service';
import * as registry from '../../../../src/core/integrations/plugins/PluginRegistry';
import * as featureRepo from '../../../../src/core/db/repos/featureRepo';

const getPluginCatalog = registry.getPluginCatalog as unknown as jest.Mock;
const getFeatureGated = registry.getFeatureGatedPluginCodes as unknown as jest.Mock;
const listFeatures = featureRepo.listFeatures as unknown as jest.Mock;

describe('MetaApiService.getPlugins feature-gated enablement', () => {
  it('enables a feature-gated plugin when its gating feature is enabled', async () => {
    getPluginCatalog.mockReturnValue([
      { code: 'cdogs-v2', hasApi: false },
      { code: 'cdogs-v3', hasApi: false },
      { code: 'docgen-noop', hasApi: false },
    ]);
    // Any plugin kind that declares a featureCode is reported here; docgen-noop declares none.
    getFeatureGated.mockReturnValue([
      { code: 'cdogs-v2', featureCode: 'document-generation-v2' },
      { code: 'cdogs-v3', featureCode: 'document-generation-v3' },
    ]);
    listFeatures.mockResolvedValue([
      { code: 'document-generation-v2', status: 'enabled' },
      { code: 'document-generation-v3', status: 'disabled' },
    ]);

    const { plugins } = await metaApiService.getPlugins();
    const enabledByCode = Object.fromEntries(plugins.map((p) => [p.code, p.enabled]));

    expect(enabledByCode['cdogs-v2']).toBe(true); // gating feature enabled
    expect(enabledByCode['cdogs-v3']).toBe(false); // gating feature disabled
    expect(enabledByCode['docgen-noop']).toBe(false); // not feature-gated
  });
});
