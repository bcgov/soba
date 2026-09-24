import { CstarEngineAdapter } from '../../../src/plugins/tenant-cstar/CstarEngineAdapter';

describe('CstarEngineAdapter', () => {
  let mockPluginConfigReader: unknown;
  let adapter: CstarEngineAdapter;

  beforeEach(() => {
    mockPluginConfigReader = {
      getRequired: jest.fn().mockReturnValue('https://api.example.com'),
    };
    adapter = new CstarEngineAdapter(
      mockPluginConfigReader as import('../../../src/core/config/pluginConfig').PluginConfigReader,
    );
    global.fetch = jest.fn();
  });

  it('readinessCheck returns ok: true on 200 response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
    const result = await adapter.readinessCheck();
    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/health', expect.any(Object));
  });

  it('readinessCheck returns ok: true on 404 response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
    const result = await adapter.readinessCheck();
    expect(result).toEqual({ ok: true });
  });

  it('readinessCheck returns ok: false on other status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
    const result = await adapter.readinessCheck();
    expect(result).toEqual({ ok: false, message: 'HTTP 500' });
  });

  it('readinessCheck returns ok: false on error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    const result = await adapter.readinessCheck();
    expect(result).toEqual({ ok: false, message: 'Network error' });
  });
  it('getTenants throws if userId is missing', async () => {
    await expect(
      adapter.getTenants({
        token: 'abc',
      } as unknown as import('../../../src/core/integrations/tenant/TenantEngineAdapter').GetTenantsInput),
    ).rejects.toThrow('User Id not provided');
  });

  it('throws if token is missing', async () => {
    await expect(
      adapter.getTenants({
        userId: '123',
      } as unknown as import('../../../src/core/integrations/tenant/TenantEngineAdapter').GetTenantsInput),
    ).rejects.toThrow('Token not provided');
  });

  it('getTenants returns tenants array on success', async () => {
    const mockTenants = [{ id: 't1', name: 'Tenant 1' }];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ data: { tenants: mockTenants } }),
    });
    const result = await adapter.getTenants({ userId: '123', token: 'Bearer abc' });
    expect(result).toEqual({ tenants: mockTenants });
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/users/123/tenants', {
      method: 'GET',
      headers: { Authorization: 'Bearer abc' },
      signal: expect.any(Object),
    });
  });

  it('getTenants returns error on failure response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
    const result = await adapter.getTenants({ userId: '123', token: 'Bearer abc' });
    expect(result).toEqual({ ok: false, message: 'HTTP 500' });
  });

  it('getTenants returns error on exception', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Fetch failed'));
    const result = await adapter.getTenants({ userId: '123', token: 'Bearer abc' });
    expect(result).toEqual({ ok: false, message: 'Fetch failed' });
  });
});
