import {
  getActivePluginCodes,
  resolveActivePluginCode,
} from '../../../../src/core/integrations/plugins/PluginRegistry';

// resolveActivePluginCode reads process.env live, so these exercise the real
// single-source resolution the adapter getters and /meta/plugins both use.
describe('active plugin code resolution', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('defaults match what the adapter getters instantiate', () => {
    delete process.env.VIRUSSCAN_DEFAULT_CODE;
    delete process.env.TEMPSTORAGE_DEFAULT_CODE;
    delete process.env.CACHE_DEFAULT_CODE;
    delete process.env.MESSAGEBUS_DEFAULT_CODE;
    expect(resolveActivePluginCode('virusScan')).toBe('virusscan-noop');
    expect(resolveActivePluginCode('tempStorage')).toBe('tempstorage-os');
    expect(resolveActivePluginCode('cache')).toBe('cache-memory');
    expect(resolveActivePluginCode('messagebus')).toBe('messagebus-memory');

    const active = getActivePluginCodes();
    expect(active.has('virusscan-noop')).toBe(true);
    expect(active.has('tempstorage-os')).toBe(true);
  });

  it('reflects env overrides', () => {
    process.env.VIRUSSCAN_DEFAULT_CODE = 'virusscan-clamav';
    process.env.TEMPSTORAGE_DEFAULT_CODE = 'tempstorage-mount';
    expect(resolveActivePluginCode('virusScan')).toBe('virusscan-clamav');
    expect(resolveActivePluginCode('tempStorage')).toBe('tempstorage-mount');

    const active = getActivePluginCodes();
    expect(active.has('virusscan-clamav')).toBe(true);
    expect(active.has('tempstorage-mount')).toBe(true);
    expect(active.has('virusscan-noop')).toBe(false);
  });
});
