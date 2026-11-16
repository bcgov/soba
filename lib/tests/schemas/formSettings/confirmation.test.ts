import {
  CONFIRMATION_SETTING_FEATURES,
  CONFIRMATION_SETTINGS,
  ConfirmationSettingsSchema,
  keepUnavailableSettings,
  SetFormConfirmationSettingsBodySchema,
  WorkspaceConfirmationSettingsSchema,
} from '../../../src/schemas/formSettings';

const ALL = { allowSubmitterEmailCopy: true, showConfirmationId: true };

describe('confirmation settings', () => {
  it('accepts the full settings object', () => {
    expect(WorkspaceConfirmationSettingsSchema.safeParse({ values: ALL, version: 1 }).success).toBe(
      true,
    );
  });

  // A save sends every setting, so a missing or mistyped flag is refused rather than defaulted.
  it.each([
    ['no flags', {}],
    ['a missing flag', { allowSubmitterEmailCopy: true }],
    ['a non-boolean flag', { ...ALL, showConfirmationId: 'yes' }],
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
      SetFormConfirmationSettingsBodySchema.safeParse({ inherit: false, values: ALL, version: 1 })
        .success,
    ).toBe(true);
  });

  it('names a feature for every setting in the schema', () => {
    expect([...CONFIRMATION_SETTINGS].sort()).toEqual(
      Object.keys(ConfirmationSettingsSchema.shape).sort(),
    );
    expect(new Set(Object.values(CONFIRMATION_SETTING_FEATURES)).size).toBe(
      CONFIRMATION_SETTINGS.length,
    );
  });
});

describe('keepUnavailableSettings', () => {
  const sent = { allowSubmitterEmailCopy: false, showConfirmationId: false };
  const current = { allowSubmitterEmailCopy: true, showConfirmationId: true };

  it('writes what was sent while every setting is available', () => {
    expect(
      keepUnavailableSettings(sent, current, {
        allowSubmitterEmailCopy: true,
        showConfirmationId: true,
      }),
    ).toEqual(sent);
  });

  it('keeps the current value of a setting whose feature is off', () => {
    expect(
      keepUnavailableSettings(sent, current, {
        allowSubmitterEmailCopy: true,
        showConfirmationId: false,
      }),
    ).toEqual({ allowSubmitterEmailCopy: false, showConfirmationId: true });
  });

  it('changes nothing while every setting is off', () => {
    expect(
      keepUnavailableSettings(sent, current, {
        allowSubmitterEmailCopy: false,
        showConfirmationId: false,
      }),
    ).toEqual(current);
  });
});
