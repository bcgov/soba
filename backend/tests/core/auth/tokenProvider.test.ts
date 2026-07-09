import { NoOpTokenProvider, StaticTokenProvider } from '../../../src/core/auth/tokenProvider';

describe('TokenProvider', () => {
  it('NoOpTokenProvider always returns null', async () => {
    const provider = new NoOpTokenProvider();
    const token = await provider.getToken();
    expect(token).toBeNull();
  });

  it('NoOpTokenProvider returns null on multiple calls', async () => {
    const provider = new NoOpTokenProvider();
    const token1 = await provider.getToken();
    const token2 = await provider.getToken();
    expect(token1).toBeNull();
    expect(token2).toBeNull();
  });

  it('StaticTokenProvider returns the token provided in constructor', async () => {
    const testToken = 'my-static-token';
    const provider = new StaticTokenProvider(testToken);
    const token = await provider.getToken();
    expect(token).toBe(testToken);
  });

  it('StaticTokenProvider returns the same token on multiple calls', async () => {
    const testToken = 'consistent-token';
    const provider = new StaticTokenProvider(testToken);
    const token1 = await provider.getToken();
    const token2 = await provider.getToken();
    expect(token1).toBe(testToken);
    expect(token2).toBe(testToken);
  });

  it('StaticTokenProvider handles tokens with special characters', async () => {
    const testToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const provider = new StaticTokenProvider(testToken);
    const token = await provider.getToken();
    expect(token).toBe(testToken);
  });

  it('StaticTokenProvider handles empty string token', async () => {
    const testToken = '';
    const provider = new StaticTokenProvider(testToken);
    const token = await provider.getToken();
    expect(token).toBe('');
  });
});
