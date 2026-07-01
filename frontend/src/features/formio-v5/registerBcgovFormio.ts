import { loadFeaturesMeta } from '@/src/shared/config/featuresMeta';
import { createIsFeatureAllowed, FEATURE_CODES } from '@/src/shared/featureFlags/flags';
import { getKeycloakInstance } from '@/lib/slices/keycloakSlice';
import { getWorkspaceId } from '@/src/shared/workspace/workspaceStore';
import { getSobaApiBaseUrl, loadFrontendRuntimeConfig } from '@/src/shared/config/runtimeConfig';

interface ChefsProviderConfig {
  /** Files collection URL; the provider posts here and builds each file's url as `${filesUrl}/<id>`. */
  filesUrl: string | (() => string | Promise<string>);
  getToken: () => string | Promise<string>;
  getWorkspaceId?: () => string | Promise<string>;
  getSubmissionId?: () => string | Promise<string>;
}

interface BcgovFormioModule {
  default?: unknown;
  createChefsProvider?: (config: ChefsProviderConfig) => unknown;
}

interface FormioWithProviders {
  use: (plugin: unknown) => void;
  Providers?: { addProvider: (type: string, name: string, provider: unknown) => void };
}

let registrationPromise: Promise<{ filesEnabled: boolean }> | null = null;

/**
 * Register the BC Gov Form.io components and, when the `files` feature is on, the CHEFS storage
 * provider. Idempotent. Enablement comes from GET /meta/features, so nothing bcgov loads when the
 * feature is off. The provider is injected with the app's api base, token, and workspace id.
 */
export function ensureBcgovFormioRegistered(): Promise<{ filesEnabled: boolean }> {
  if (registrationPromise) return registrationPromise;

  registrationPromise = (async () => {
    const meta = await loadFeaturesMeta().catch(() => null);
    const filesEnabled = meta ? createIsFeatureAllowed(meta)(FEATURE_CODES.FILES) : false;
    if (!filesEnabled) return { filesEnabled };

    // Load runtime config first so getSobaApiBaseUrl() returns the resolved API base, not the early
    // bootstrap value, when filesUrl is read.
    await loadFrontendRuntimeConfig().catch(() => {});

    const { Formio } = await import('@formio/js');
    const bcgovMod = (await import('@bcgov/formio-components')) as unknown as BcgovFormioModule;
    const formio = Formio as unknown as FormioWithProviders;

    formio.use(bcgovMod.default ?? bcgovMod);

    const createChefsProvider = bcgovMod.createChefsProvider;
    if (createChefsProvider && formio.Providers) {
      formio.Providers.addProvider(
        'storage',
        'chefs',
        createChefsProvider({
          // A getter so getSobaApiBaseUrl() is read per request (after runtime config has loaded).
          filesUrl: () => {
            const apiUrl = getSobaApiBaseUrl();
            return `${apiUrl}/files`;
          },
          getToken: async () => {
            const kc = getKeycloakInstance();
            try {
              await kc?.updateToken(30);
            } catch {
              // Keep the existing token; the request 401s if it is genuinely expired.
            }
            return kc?.token ?? '';
          },
          getWorkspaceId: () => getWorkspaceId() ?? '',
          // Placeholder: SOBA has no submission id at upload time yet (submission editing TBD).
          getSubmissionId: () =>
            typeof window !== 'undefined'
              ? (window.sessionStorage.getItem('soba.submissionId') ?? '')
              : '',
        }),
      );
    }

    return { filesEnabled };
  })();

  return registrationPromise;
}
