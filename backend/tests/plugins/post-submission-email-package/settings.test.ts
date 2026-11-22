import { resolvePackageSettings } from '../../../src/plugins/post-submission-email-package/settings';

const RETENTION = 'PLUGIN_POST_SUBMISSION_EMAIL_PACKAGE_RETENTION_DAYS';

describe('email-package settings', () => {
  it('keeps a package 7 days by default, and treats an empty value as unset', () => {
    expect(resolvePackageSettings({})).toEqual({ retentionDays: 7 });
    expect(resolvePackageSettings({ [RETENTION]: '' })).toEqual({ retentionDays: 7 });
  });

  it.each([1, 365])('takes %i, an end of its range', (days) => {
    expect(resolvePackageSettings({ [RETENTION]: String(days) })).toEqual({ retentionDays: days });
  });

  it.each(['0', '366', '-1', '2.5', 'lots'])('refuses %s, naming the variable', (value) => {
    expect(() => resolvePackageSettings({ [RETENTION]: value })).toThrow(RETENTION);
  });
});
