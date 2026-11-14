import {
  ConfirmationSettingsSchema,
  SetFormConfirmationSettingsBodySchema,
  WorkspaceConfirmationSettingsSchema,
} from '../../../src/schemas/formSettings';

describe('confirmation settings', () => {
  it('accepts the full settings object', () => {
    expect(
      WorkspaceConfirmationSettingsSchema.safeParse({
        values: { allowSubmitterEmailCopy: true },
        version: 1,
      }).success,
    ).toBe(true);
  });

  // A save sends every setting, so a missing or mistyped flag is refused rather than defaulted.
  it.each([
    ['a missing flag', {}],
    ['a non-boolean flag', { allowSubmitterEmailCopy: 'yes' }],
  ])('rejects %s', (_label, body) => {
    expect(ConfirmationSettingsSchema.safeParse(body).success).toBe(false);
    expect(
      SetFormConfirmationSettingsBodySchema.safeParse({ inherit: false, values: body, version: 1 })
        .success,
    ).toBe(false);
  });

  it('saves a form as inheriting or with its own settings', () => {
    expect(
      SetFormConfirmationSettingsBodySchema.safeParse({ inherit: true, version: 1 }).success,
    ).toBe(true);
    expect(
      SetFormConfirmationSettingsBodySchema.safeParse({
        inherit: false,
        values: { allowSubmitterEmailCopy: true },
        version: 1,
      }).success,
    ).toBe(true);
  });
});
