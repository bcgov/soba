import { describe, expect, it } from 'vitest';
import { isFeaturesMetaPayload } from '@/src/shared/config/featuresMeta';

describe('isFeaturesMetaPayload', () => {
  it('accepts valid payload', () => {
    expect(
      isFeaturesMetaPayload({
        features: [
          {
            code: 'design-mode',
            name: 'Design mode',
            description: null,
            version: null,
            status: 'enabled',
            platformAllowed: true,
          },
        ],
      }),
    ).toBe(true);
  });

  it('accepts an optional string availability', () => {
    expect(
      isFeaturesMetaPayload({
        features: [
          {
            code: 'document-generation-v3',
            name: 'Doc gen v3',
            description: null,
            version: null,
            status: 'enabled',
            platformAllowed: true,
            availability: 'scoped',
          },
        ],
      }),
    ).toBe(true);
  });

  it('rejects a non-string availability', () => {
    expect(
      isFeaturesMetaPayload({
        features: [
          {
            code: 'x',
            name: 'X',
            description: null,
            version: null,
            status: 'enabled',
            platformAllowed: true,
            availability: 3,
          },
        ],
      }),
    ).toBe(false);
  });

  it('rejects missing platformAllowed', () => {
    expect(
      isFeaturesMetaPayload({
        features: [
          {
            code: 'x',
            name: 'X',
            description: null,
            version: null,
            status: 'enabled',
          },
        ],
      }),
    ).toBe(false);
  });
});
