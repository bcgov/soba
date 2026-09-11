import { createPluginConfigReader } from '../../../../src/core/config/pluginConfig';
import { virusScanSelfTest } from '../../../../src/core/integrations/virus-scan/virusScanSelfTest';
import { virusScanPluginDefinition } from '../../../../src/plugins/virusscan-noop';

describe('virusScanSelfTest', () => {
  it('reports the noop scanner connected but not healthy (reports clean, not infected)', async () => {
    const adapter = virusScanPluginDefinition.createAdapter(
      createPluginConfigReader(virusScanPluginDefinition.code),
    );

    const result = await virusScanSelfTest(adapter);

    expect(result.scannerCode).toBe('virusscan-noop');
    expect(result.connected).toBe(true);
    expect(result.verdict).toBe('clean');
    expect(result.healthy).toBe(false);
  });
});
