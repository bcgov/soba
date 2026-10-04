import {
  SetFormSubmitterSettingsBodySchema,
  WorkspaceSubmitterSettingsSchema,
} from '../../../src/schemas/formSettings';

describe('submitter settings', () => {
  it('accepts the full settings object', () => {
    expect(WorkspaceSubmitterSettingsSchema.safeParse({ allowSubmitterDrafts: true }).success).toBe(
      true,
    );
  });

  // A save sends every setting, so a missing or mistyped flag is refused rather than defaulted.
  it.each([
    ['a missing flag', {}],
    ['a non-boolean flag', { allowSubmitterDrafts: 'yes' }],
  ])('rejects %s', (_label, body) => {
    expect(WorkspaceSubmitterSettingsSchema.safeParse(body).success).toBe(false);
    expect(
      SetFormSubmitterSettingsBodySchema.safeParse({ inherit: false, values: body }).success,
    ).toBe(false);
  });

  it('saves a form as inheriting or with its own settings', () => {
    expect(SetFormSubmitterSettingsBodySchema.safeParse({ inherit: true }).success).toBe(true);
    expect(
      SetFormSubmitterSettingsBodySchema.safeParse({
        inherit: false,
        values: { allowSubmitterDrafts: true },
      }).success,
    ).toBe(true);
  });
});
