import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

// The Keycloak instance is the external boundary; the store below is real.
const kc = {
  token: undefined as string | undefined,
  refreshToken: undefined as string | undefined,
  authenticated: false,
  idTokenParsed: {} as Record<string, unknown>,
  updateToken: vi.fn(),
  init: vi.fn().mockResolvedValue(true),
  login: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
};

// A function expression, not an arrow: the slice calls `new Keycloak(...)`.
vi.mock('keycloak-js', () => ({
  default: vi.fn(function () {
    return kc;
  }),
}));
vi.mock('@/src/shared/config/runtimeConfig', () => ({
  loadFrontendRuntimeConfig: vi.fn().mockResolvedValue({
    auth: { keycloak: { url: 'http://kc.test', realm: 'r', clientId: 'c' } },
  }),
  getSobaApiBaseUrl: () => 'http://api.test',
}));
vi.mock('@/src/features/formio-v5/disableFormioBrowserAuth', () => ({
  disableFormioBrowserAuth: vi.fn(),
}));

const { initKeycloak, login, logout, refreshAccessToken, getKeycloakInstance, signInAfterRefusal } =
  await import('@/lib/slices/keycloakSlice');
const { default: makeStore } = await import('@/lib/store');

type Store = ReturnType<typeof makeStore>;

async function storeWithSession(): Promise<Store> {
  const store = makeStore();
  await store.dispatch(initKeycloak());
  return store;
}

// Drop any instance left by a previous test so initKeycloak builds a fresh one.
function dropKeycloakInstance(): void {
  if (getKeycloakInstance()) makeStore().dispatch({ type: 'keycloak/clear' });
}

describe('initKeycloak', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dropKeycloakInstance();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('points the silent check at the base path', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/chefs');
    await makeStore().dispatch(initKeycloak());
    expect(kc.init).toHaveBeenCalledWith(
      expect.objectContaining({
        silentCheckSsoRedirectUri: `${window.location.origin}/chefs/silent-check-sso.html`,
      }),
    );
  });
});

describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dropKeycloakInstance();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // After page-load init, keycloak-js refuses a second init, so every sign-in takes this redirect.
  it('returns to the base path after sign-in', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/chefs');
    const store = await storeWithSession();
    kc.init.mockRejectedValueOnce(new Error("A 'Keycloak' instance can only be initialized once."));

    await store.dispatch(login());

    expect(kc.login).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/chefs` });
  });

  it('returns to the address it is given after sign-in', async () => {
    const store = await storeWithSession();
    kc.init.mockRejectedValueOnce(new Error("A 'Keycloak' instance can only be initialized once."));

    await store.dispatch(login('http://app.test/en/submission/sub-1'));

    expect(kc.login).toHaveBeenCalledWith({ redirectUri: 'http://app.test/en/submission/sub-1' });
  });

  // With no instance yet, the forced login flow runs and must carry the address too.
  it('passes the address to a forced login when there is no instance', async () => {
    await makeStore().dispatch(login('http://app.test/en/submission/sub-1'));

    expect(kc.init).toHaveBeenCalledWith(
      expect.objectContaining({
        onLoad: 'login-required',
        redirectUri: 'http://app.test/en/submission/sub-1',
      }),
    );
  });

  // Without an address the forced flow keeps the keycloak-js default: the current page.
  it('leaves a forced login with no address on the current page', async () => {
    await makeStore().dispatch(login());

    expect(kc.init).toHaveBeenCalledWith(
      expect.objectContaining({ onLoad: 'login-required', redirectUri: undefined }),
    );
  });
});

describe('logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dropKeycloakInstance();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns to the home page', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/chefs');
    const store = await storeWithSession();

    store.dispatch(logout());

    expect(kc.logout).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/chefs` });
  });

  // keycloak-js resolves logout as soon as the redirect starts, while the page is still here.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  // A read refused after logout's clear() would start a sign-in that cancels the logout.
  it('skips the sign-in after a refusal while the logout redirect is under way', async () => {
    const store = await storeWithSession();
    store.dispatch(logout());
    await settle();

    await store.dispatch(signInAfterRefusal('http://app.test/en/submission/sub-1'));

    expect(kc.init).toHaveBeenCalledTimes(1);
    expect(kc.login).not.toHaveBeenCalled();
  });

  // A logout the browser did not follow, such as one cancelled at the leave prompt.
  it('still signs in when asked after a logout that did not leave the page', async () => {
    const store = await storeWithSession();
    store.dispatch(logout());
    await settle();

    await store.dispatch(login());

    expect(kc.init).toHaveBeenCalledTimes(2);
    expect(kc.init).toHaveBeenLastCalledWith(expect.objectContaining({ onLoad: 'login-required' }));
  });

  it('lets the sign-in after a refusal through once the logout fails', async () => {
    const store = await storeWithSession();
    kc.logout.mockRejectedValueOnce(new Error('logout failed'));
    store.dispatch(logout());
    await settle();

    await store.dispatch(signInAfterRefusal('http://app.test/en/submission/sub-1'));

    expect(kc.init).toHaveBeenLastCalledWith(
      expect.objectContaining({
        onLoad: 'login-required',
        redirectUri: 'http://app.test/en/submission/sub-1',
      }),
    );
  });

  it('lets the sign-in after a refusal through once Keycloak boots afresh', async () => {
    const store = await storeWithSession();
    store.dispatch(logout());
    await store.dispatch(initKeycloak());
    kc.init.mockRejectedValueOnce(new Error("A 'Keycloak' instance can only be initialized once."));

    await store.dispatch(signInAfterRefusal('http://app.test/en/submission/sub-1'));

    expect(kc.login).toHaveBeenCalledWith({ redirectUri: 'http://app.test/en/submission/sub-1' });
  });
});

describe('refreshAccessToken', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    kc.token = 'live-token';
    kc.refreshToken = 'refresh-token';
    kc.authenticated = true;
    kc.updateToken.mockReset();
    dropKeycloakInstance();
  });

  it('mirrors a real refresh into the store', async () => {
    const store = await storeWithSession();
    kc.updateToken.mockImplementation(async () => {
      kc.token = 'rotated';
      return true;
    });

    const outcome = await store.dispatch(refreshAccessToken(false));

    expect(outcome).toEqual({ status: 'token', token: 'rotated' });
    expect(store.getState().keycloak.token).toBe('rotated');
  });

  it('leaves the store alone when no refresh was needed', async () => {
    const store = await storeWithSession();
    kc.updateToken.mockResolvedValue(false);

    const outcome = await store.dispatch(refreshAccessToken(false));

    expect(outcome).toEqual({ status: 'token', token: 'live-token' });
    expect(store.getState().keycloak.token).toBe('live-token');
  });

  // The decision that signs a user out. keycloak-js drops its own token only when the refresh
  // token is rejected, so that — not `force` — is the verdict.
  it.each([
    ['a blip on the proactive path', false, true],
    ['a blip on the forced path', true, true],
  ])('keeps the session through %s', async (_label, force, stillAuthenticated) => {
    const store = await storeWithSession();
    kc.authenticated = stillAuthenticated;
    kc.updateToken.mockRejectedValue(new Error('network'));

    const outcome = await store.dispatch(refreshAccessToken(force));

    expect(outcome).toEqual({ status: 'token', token: 'live-token' });
    expect(store.getState().keycloak.authenticated).toBe(true);
  });

  it.each([
    ['the proactive path', false],
    ['the forced path', true],
  ])('clears the session on a rejected refresh token via %s', async (_label, force) => {
    const store = await storeWithSession();
    kc.updateToken.mockImplementation(async () => {
      // What keycloak-js does on a 400 from the token endpoint.
      kc.token = undefined;
      kc.authenticated = false;
      throw new Error('rejected');
    });

    const outcome = await store.dispatch(refreshAccessToken(force));

    expect(outcome).toEqual({ status: 'no-session' });
    expect(store.getState().keycloak.authenticated).toBe(false);
  });

  // After clear() the instance is gone. That must read as "session over", not "no verdict" — the
  // latter makes sobaFetch send the caller's dead token, which the submit surface takes as anonymous.
  it('reports no-session once the session has been cleared', async () => {
    const store = await storeWithSession();
    kc.updateToken.mockImplementation(async () => {
      kc.token = undefined;
      kc.authenticated = false;
      throw new Error('rejected');
    });
    await store.dispatch(refreshAccessToken(true));

    // A later caller still holding a token from before the clear.
    const outcome = await store.dispatch(refreshAccessToken(false));

    expect(outcome).toEqual({ status: 'no-session' });
  });

  it('does not touch an anonymous instance that has no refresh token', async () => {
    kc.token = undefined;
    kc.refreshToken = undefined;
    kc.authenticated = false;
    const store = await storeWithSession();
    kc.updateToken.mockClear(); // init calls it once; we care about what the refresh does

    const outcome = await store.dispatch(refreshAccessToken(false));

    expect(kc.updateToken).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'unavailable' });
  });
});
