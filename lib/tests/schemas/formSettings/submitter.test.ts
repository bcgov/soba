import { SetSubmitterSettingsBodySchema } from '../../../src/schemas/formSettings';

describe('SetSubmitterSettingsBodySchema', () => {
  it('accepts the full settings object', () => {
    expect(SetSubmitterSettingsBodySchema.safeParse({ allowSubmitterDrafts: true }).success).toBe(
      true,
    );
  });

  // A save sends every setting, so a missing or mistyped flag is refused rather than defaulted.
  it.each([
    ['a missing flag', {}],
    ['a non-boolean flag', { allowSubmitterDrafts: 'yes' }],
  ])('rejects %s', (_label, body) => {
    expect(SetSubmitterSettingsBodySchema.safeParse(body).success).toBe(false);
  });
});
