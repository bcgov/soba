import { describe, it, expect } from 'vitest';
import {
  normalizeFeatureCode,
  parseFrontendFeaturesAllowlist,
  createIsFeatureAllowed,
} from '@/src/shared/featureFlags/flags';
import type { FeaturesMetaPayload } from '@/src/shared/config/featuresMeta';

const sampleMeta = {
  features: [
    {
      code: 'workspaces',
      name: 'Workspaces',
      description: null,
      version: null,
      status: 'active',
      platformAllowed: true,
    },
    {
      code: 'design-mode',
      name: 'Design Mode',
      description: null,
      version: null,
      status: 'active',
      platformAllowed: true,
    },
    {
      code: 'submit-mode',
      name: 'Submit Mode',
      description: null,
      version: null,
      status: 'inactive',
      platformAllowed: false,
    },
  ],
};

describe('feature flags utilities', () => {
  it('normalizeFeatureCode trims and lowercases', () => {
    expect(normalizeFeatureCode('  DESIGN-MODE ')).toBe('design-mode');
  });

  it('parseFrontendFeaturesAllowlist handles undefined and wildcard', () => {
    expect(parseFrontendFeaturesAllowlist(undefined)).toEqual(new Set());
    expect(parseFrontendFeaturesAllowlist('*')).toBe('all');
    const set = parseFrontendFeaturesAllowlist(' workspaces , design-mode ');
    expect(set instanceof Set).toBeTruthy();
    expect((set as Set<string>).has('workspaces')).toBeTruthy();
  });

  it('createIsFeatureAllowed respects platform and frontend policy', () => {
    const meta = sampleMeta as unknown as FeaturesMetaPayload;
    const fn = createIsFeatureAllowed(meta);
    // By default process.env likely doesn't include features so none allowed
    expect(fn('workspaces')).toBe(false);
  });
});
