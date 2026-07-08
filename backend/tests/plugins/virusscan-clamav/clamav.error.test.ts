import { createEnvReader } from '../../../src/core/config/env';
import { createPluginConfigReaderFrom } from '../../../src/core/config/pluginConfig';
import { parseClamavUrl, virusScanPluginDefinition } from '../../../src/plugins/virusscan-clamav';

// Points the adapter at a closed local port so the connection is refused fast.
// No mocks: this exercises the real failure path (unreachable clamd → 'error').
function unreachableAdapter() {
  const source = {
    PLUGIN_VIRUSSCAN_CLAMAV_URL: '127.0.0.1:1',
    PLUGIN_VIRUSSCAN_CLAMAV_TIMEOUT_MS: '500',
  };
  const config = createPluginConfigReaderFrom(createEnvReader(source), 'virusscan-clamav');
  return virusScanPluginDefinition.createAdapter(config);
}

describe('parseClamavUrl', () => {
  it('parses host:port', () => {
    expect(parseClamavUrl('soba-clamav:3310', 3310)).toEqual({ host: 'soba-clamav', port: 3310 });
  });

  it('defaults the port when only a host is given', () => {
    expect(parseClamavUrl('clamav', 3310)).toEqual({ host: 'clamav', port: 3310 });
  });

  it('strips a scheme and trailing path', () => {
    expect(parseClamavUrl('tcp://clamav:3311/ignored', 3310)).toEqual({
      host: 'clamav',
      port: 3311,
    });
  });
});

describe('virusscan-clamav (clamd unreachable)', () => {
  it('has the expected code', () => {
    expect(virusScanPluginDefinition.code).toBe('virusscan-clamav');
  });

  it('scanBuffer returns an error verdict rather than throwing', async () => {
    const res = await unreachableAdapter().scanBuffer(Buffer.from('data'));
    expect(res.verdict).toBe('error');
    expect(res.scannerCode).toBe('virusscan-clamav');
    expect(res.viruses).toEqual([]);
    expect(res.message).toBeTruthy();
  });

  it('ping resolves false when the scanner is unreachable', async () => {
    await expect(unreachableAdapter().ping()).resolves.toBe(false);
  });
});
