export type FrontendRuntimeConfig = {
  auth: {
    provider: 'keycloak';
    idpPluginDefaultCode: string;
    keycloak: {
      url: string;
      realm: string;
      clientId: string;
      pkceMethod: 'S256';
    };
  };
  api: {
    baseUrl: string;
  };
  build: {
    name: string;
    version: string;
  };
};

const DEFAULT_SOBA_API_BASE_URL =
  process.env.NEXT_PUBLIC_SOBA_API_BASE_URL || 'http://localhost:4000/api/v1';

let cachedConfig: FrontendRuntimeConfig | null = null;
let configPromise: Promise<FrontendRuntimeConfig> | null = null;

export function isRuntimeConfigPayload(config: unknown): config is FrontendRuntimeConfig {
  if (!config || typeof config !== 'object') return false;
  const parsed = config as Partial<FrontendRuntimeConfig>;
  return !!(
    parsed.auth?.keycloak?.url &&
    parsed.auth.keycloak.realm &&
    parsed.auth.keycloak.clientId &&
    parsed.api?.baseUrl
  );
}

function assertRuntimeConfigShape(config: unknown): asserts config is FrontendRuntimeConfig {
  if (!isRuntimeConfigPayload(config)) {
    throw new Error('Runtime config payload is invalid');
  }
}

export async function loadFrontendRuntimeConfig(): Promise<FrontendRuntimeConfig> {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;

  configPromise = fetch(`${DEFAULT_SOBA_API_BASE_URL}/meta/frontend-config`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load runtime config: ${response.status}`);
      }
      const payload = (await response.json()) as unknown;
      assertRuntimeConfigShape(payload);
      cachedConfig = payload;
      return payload;
    })
    .finally(() => {
      configPromise = null;
    });

  return configPromise;
}

export function getCachedFrontendRuntimeConfig(): FrontendRuntimeConfig | null {
  return cachedConfig;
}

export function getSobaApiBaseUrl(): string {
  return cachedConfig?.api.baseUrl ?? DEFAULT_SOBA_API_BASE_URL;
}
