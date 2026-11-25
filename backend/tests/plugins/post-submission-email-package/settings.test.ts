import { resolvePackageSettings } from '../../../src/plugins/post-submission-email-package/settings';

const KEY = 'PLUGIN_POST_SUBMISSION_EMAIL_PACKAGE_';
const DEFAULTS = { maxFileMb: 25, maxPackageMb: 100, retentionDays: 7 };

describe('email-package settings', () => {
  it('defaults to 25 MB a file, 100 MB a package and 7 days, treating empty as unset', () => {
    expect(resolvePackageSettings({})).toEqual(DEFAULTS);
    expect(resolvePackageSettings({ [`${KEY}RETENTION_DAYS`]: '' })).toEqual(DEFAULTS);
  });

  it.each([
    ['MAX_FILE_MB', '1', { maxFileMb: 1 }],
    ['MAX_FILE_MB', '1024', { maxFileMb: 1024 }],
    ['MAX_PACKAGE_MB', '1', { maxPackageMb: 1 }],
    ['MAX_PACKAGE_MB', '1024', { maxPackageMb: 1024 }],
    ['RETENTION_DAYS', '1', { retentionDays: 1 }],
    ['RETENTION_DAYS', '365', { retentionDays: 365 }],
  ])('takes %s=%s, an end of its range', (name, value, expected) => {
    expect(resolvePackageSettings({ [`${KEY}${name}`]: value })).toEqual({
      ...DEFAULTS,
      ...expected,
    });
  });

  it.each([
    ['MAX_FILE_MB', '0'],
    ['MAX_FILE_MB', '1025'],
    ['MAX_PACKAGE_MB', '0'],
    ['MAX_PACKAGE_MB', '2.5'],
    ['MAX_PACKAGE_MB', 'lots'],
    ['RETENTION_DAYS', '366'],
    ['RETENTION_DAYS', '-1'],
  ])('refuses %s=%s, naming the variable', (name, value) => {
    expect(() => resolvePackageSettings({ [`${KEY}${name}`]: value })).toThrow(`${KEY}${name}`);
  });
});
