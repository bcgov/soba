import { resolvePackageSettings } from '../../../src/plugins/post-submission-email-package/settings';

const MB = 1024 * 1024;
const KEY = 'PLUGIN_POST_SUBMISSION_EMAIL_PACKAGE_';

describe('email-package settings', () => {
  it('defaults to 25 MB a file, 100 MB a package and 7 days', () => {
    expect(resolvePackageSettings({})).toEqual({
      maxFileBytes: 25 * MB,
      maxPackageBytes: 100 * MB,
      retentionDays: 7,
    });
  });

  it('treats an empty value as unset', () => {
    expect(resolvePackageSettings({ [`${KEY}RETENTION_DAYS`]: '' }).retentionDays).toBe(7);
  });

  it('takes each setting at the ends of its range', () => {
    expect(
      resolvePackageSettings({
        [`${KEY}MAX_FILE_MB`]: '1',
        [`${KEY}MAX_PACKAGE_MB`]: '1024',
        [`${KEY}RETENTION_DAYS`]: '365',
      }),
    ).toEqual({ maxFileBytes: MB, maxPackageBytes: 1024 * MB, retentionDays: 365 });
  });

  it.each([
    ['MAX_FILE_MB', '0'],
    ['MAX_FILE_MB', '1025'],
    ['MAX_PACKAGE_MB', '2.5'],
    ['MAX_PACKAGE_MB', 'lots'],
    ['RETENTION_DAYS', '366'],
    ['RETENTION_DAYS', '-1'],
  ])('refuses %s=%s, naming the variable', (name, value) => {
    expect(() => resolvePackageSettings({ [`${KEY}${name}`]: value })).toThrow(`${KEY}${name}`);
  });
});
