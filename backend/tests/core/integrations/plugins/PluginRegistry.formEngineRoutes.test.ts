import {
  getFormEngineRouteDefinitions,
  getFormEnginePluginDefinitions,
} from '../../../../src/core/integrations/plugins/PluginRegistry';

describe('getFormEngineRouteDefinitions', () => {
  const ROUTES_ENABLED_KEY = 'PLUGIN_FORMIO_V5_ROUTES_ENABLED';
  const PROXY_PATH_KEY = 'PLUGIN_FORMIO_V5_PROXY_PATH';

  function saveEnv(): Record<string, string | undefined> {
    return {
      [ROUTES_ENABLED_KEY]: process.env[ROUTES_ENABLED_KEY],
      [PROXY_PATH_KEY]: process.env[PROXY_PATH_KEY],
    };
  }

  function restoreEnv(saved: Record<string, string | undefined>): void {
    if (saved[ROUTES_ENABLED_KEY] !== undefined) {
      process.env[ROUTES_ENABLED_KEY] = saved[ROUTES_ENABLED_KEY];
    } else {
      delete process.env[ROUTES_ENABLED_KEY];
    }
    if (saved[PROXY_PATH_KEY] !== undefined) {
      process.env[PROXY_PATH_KEY] = saved[PROXY_PATH_KEY];
    } else {
      delete process.env[PROXY_PATH_KEY];
    }
  }

  it('returns only definitions that have routeBasePath and createRouter', () => {
    const defs = getFormEnginePluginDefinitions();
    const withRoutes = defs.filter(
      (d) => d.routeBasePath !== undefined && d.createRouter !== undefined,
    );
    expect(withRoutes.length).toBeGreaterThanOrEqual(0);
    getFormEngineRouteDefinitions().forEach((r) => {
      expect(r.code).toBeDefined();
      expect(r.routeBasePath).toBeDefined();
      expect(typeof r.createRouter).toBe('function');
    });
  });

  it('excludes formio-v5 when PLUGIN_FORMIO_V5_ROUTES_ENABLED is not true', () => {
    const saved = saveEnv();
    try {
      delete process.env[ROUTES_ENABLED_KEY];
      process.env[ROUTES_ENABLED_KEY] = 'false';
      const routeDefs = getFormEngineRouteDefinitions();
      const formioV5 = routeDefs.find((r) => r.code === 'formio-v5');
      expect(formioV5).toBeUndefined();
    } finally {
      restoreEnv(saved);
    }
  });

  it('includes formio-v5 with default path when ROUTES_ENABLED is true', () => {
    const saved = saveEnv();
    try {
      process.env[ROUTES_ENABLED_KEY] = 'true';
      delete process.env[PROXY_PATH_KEY];
      const routeDefs = getFormEngineRouteDefinitions();
      const formioV5 = routeDefs.find((r) => r.code === 'formio-v5');
      expect(formioV5).toBeDefined();
      expect(formioV5!.code).toBe('formio-v5');
      expect(formioV5!.routeBasePath).toBe('/formio-v5');
      expect(typeof formioV5!.createRouter).toBe('function');
    } finally {
      restoreEnv(saved);
    }
  });

  it('uses PLUGIN_FORMIO_V5_PROXY_PATH when set and ROUTES_ENABLED is true', () => {
    const saved = saveEnv();
    try {
      process.env[ROUTES_ENABLED_KEY] = 'true';
      process.env[PROXY_PATH_KEY] = '/custom-formio';
      const routeDefs = getFormEngineRouteDefinitions();
      const formioV5 = routeDefs.find((r) => r.code === 'formio-v5');
      expect(formioV5).toBeDefined();
      expect(formioV5!.routeBasePath).toBe('/custom-formio');
    } finally {
      restoreEnv(saved);
    }
  });

  it('treats ROUTES_ENABLED as case-insensitive true', () => {
    const saved = saveEnv();
    try {
      process.env[ROUTES_ENABLED_KEY] = 'TRUE';
      const routeDefs = getFormEngineRouteDefinitions();
      const formioV5 = routeDefs.find((r) => r.code === 'formio-v5');
      expect(formioV5).toBeDefined();
    } finally {
      restoreEnv(saved);
    }
  });
});
