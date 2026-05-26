import { describe, expect, it } from 'vitest';
import { isFeaturesMetaPayload } from '@/src/shared/config/featuresMeta';

describe('isFeaturesMetaPayload', () => {
  it('accepts valid payload', () => {
    expect(
      isFeaturesMetaPayload({
        features: [
          {
            code: 'designer',
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
