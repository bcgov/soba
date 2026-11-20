import { describe, expect, it, vi } from 'vitest';

const { apiBase } = vi.hoisted(() => ({ apiBase: { url: '' } }));
vi.mock('@/src/shared/config/runtimeConfig', () => ({ getSobaApiBaseUrl: () => apiBase.url }));

import { integrationApiDocsUrl } from '@/src/features/credentials/data/integrationApiDocs';

describe('integrationApiDocsUrl', () => {
  it.each([
    [
      'https://soba-dev-api.apps.example.test/chefs/api/v1',
      'https://soba-dev-api.apps.example.test/chefs/api/docs/?urls.primaryName=Integration%20API%20v2',
    ],
    [
      'http://localhost:4000/chefs/api/v1/',
      'http://localhost:4000/chefs/api/docs/?urls.primaryName=Integration%20API%20v2',
    ],
    [
      'https://api.example.test/api/v1',
      'https://api.example.test/api/docs/?urls.primaryName=Integration%20API%20v2',
    ],
  ])('links the docs beside %s', (base, expected) => {
    apiBase.url = base;
    expect(integrationApiDocsUrl()).toBe(expected);
  });

  it.each(['https://api.example.test/custom', 'https://api.example.test/chefs/api/v2'])(
    'gives no link for an API base that is not /api/v1: %s',
    (base) => {
      apiBase.url = base;
      expect(integrationApiDocsUrl()).toBeUndefined();
    },
  );
});
