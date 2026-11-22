import { type EnvSource, wholeNumberSetting } from '../../core/config/env';

const PREFIX = 'PLUGIN_POST_SUBMISSION_EMAIL_PACKAGE_';
const MB = 1024 * 1024;

/** Limits for building and keeping a package. */
export interface PackageSettings {
  /** An upload larger than this is left out of the package. */
  maxFileBytes: number;
  /** The largest package; the job's own result limit applies when it is lower. */
  maxPackageBytes: number;
  /** Days a package is kept, counted again each time its email step starts. */
  retentionDays: number;
}

/** The settings in `source`; unset or empty takes the default, and a value out of range throws. */
export const resolvePackageSettings = (source: EnvSource): PackageSettings => ({
  maxFileBytes: wholeNumberSetting(source, `${PREFIX}MAX_FILE_MB`, 25, { max: 1024 }) * MB,
  maxPackageBytes: wholeNumberSetting(source, `${PREFIX}MAX_PACKAGE_MB`, 100, { max: 1024 }) * MB,
  retentionDays: wholeNumberSetting(source, `${PREFIX}RETENTION_DAYS`, 7, { max: 365 }),
});
