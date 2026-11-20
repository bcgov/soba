import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

type ProviderConfig = {
  filesUrl: () => string | Promise<string>;
  getSubmissionId: () => string | Promise<string>;
  isAnonymous: () => boolean | Promise<boolean>;
};

const h = vi.hoisted(() => ({
  config: null as ProviderConfig | null,
  addProvider: vi.fn(),
}));

vi.mock('@/src/shared/config/featuresMeta', () => ({
  loadFeaturesMeta: () => Promise.resolve({ features: [] }),
}));
vi.mock('@/src/shared/featureFlags/flags', async () => ({
  ...(await vi.importActual<object>('@/src/shared/featureFlags/flags')),
  createIsFeatureAllowed: () => () => true,
}));
vi.mock('@/src/shared/config/runtimeConfig', () => ({
  loadFrontendRuntimeConfig: () => Promise.resolve(),
  getSobaApiBaseUrl: () => 'https://soba.test/api/v1',
}));
vi.mock('@/src/features/formio-v5/data/uploadToken', () => ({ uploadToken: vi.fn() }));
vi.mock('@formio/js', () => ({
  Formio: { use: vi.fn(), Providers: { addProvider: h.addProvider } },
}));
vi.mock('formio-components@0.0.3', () => ({
  default: {},
  createChefsProvider: (config: ProviderConfig) => {
    h.config = config;
    return 'chefs-provider';
  },
}));

import { ensureBcgovFormioRegistered } from '@/src/features/formio-v5/registerBcgovFormio';
import {
  clearActiveSubmission,
  setActiveOpener,
  setActiveSubmission,
} from '@/src/features/formio-v5/activeSubmission';

const provider = () => {
  if (!h.config) throw new Error('The CHEFS provider was not created');
  return h.config;
};

describe('ensureBcgovFormioRegistered', () => {
  beforeAll(async () => {
    await ensureBcgovFormioRegistered();
  });

  afterEach(() => clearActiveSubmission());

  it('registers the CHEFS provider on the files API', async () => {
    expect(h.addProvider).toHaveBeenCalledWith('storage', 'chefs', 'chefs-provider');
    expect(await provider().filesUrl()).toBe('https://soba.test/api/v1/files');
  });

  it('tags uploads with the active submission once it is open', async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    setActiveSubmission({ submissionId: 'sub-1', signedIn: true });
    setActiveOpener(open);

    expect(await provider().getSubmissionId()).toBe('sub-1');
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('treats the session as anonymous only for a fill known not to be signed in', async () => {
    expect(await provider().isAnonymous()).toBe(false);

    setActiveSubmission({ submissionId: 'sub-1', signedIn: true });
    expect(await provider().isAnonymous()).toBe(false);

    setActiveSubmission({ submissionId: 'sub-1', signedIn: false });
    expect(await provider().isAnonymous()).toBe(true);
  });
});
