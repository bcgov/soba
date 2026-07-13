import {
  getActivePluginCodes,
  resolveActivePluginCode,
} from '../../../../src/core/integrations/plugins/PluginRegistry';

// resolveActivePluginCode reads process.env live, so these exercise the real single-source
// resolution that the adapter getters and /meta/plugins both go through.
describe('active plugin code resolution', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('defaults match what the adapter getters instantiate', () => {
    delete process.env.CACHE_DEFAULT_CODE;
    delete process.env.MESSAGEBUS_DEFAULT_CODE;
    expect(resolveActivePluginCode('cache')).toBe('cache-memory');
    expect(resolveActivePluginCode('messagebus')).toBe('messagebus-memory');

    const active = getActivePluginCodes();
    expect(active.has('cache-memory')).toBe(true);
    expect(active.has('messagebus-memory')).toBe(true);
  });

  it('reflects env overrides', () => {
    process.env.CACHE_DEFAULT_CODE = 'cache-redis';
    process.env.MESSAGEBUS_DEFAULT_CODE = 'messagebus-redis';
    expect(resolveActivePluginCode('cache')).toBe('cache-redis');
    expect(resolveActivePluginCode('messagebus')).toBe('messagebus-redis');

    const active = getActivePluginCodes();
    expect(active.has('cache-redis')).toBe(true);
    expect(active.has('messagebus-redis')).toBe(true);
    expect(active.has('cache-memory')).toBe(false);
  });
});
