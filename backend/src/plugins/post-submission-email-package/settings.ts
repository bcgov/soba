import { POST_SUBMISSION_EMAIL_PACKAGE_CODE } from '@soba/lib';
import { type EnvSource, wholeNumberSetting } from '../../core/config/env';
import { normalizeKey } from '../../core/config/pluginConfig';

const PREFIX = `PLUGIN_${normalizeKey(POST_SUBMISSION_EMAIL_PACKAGE_CODE)}_`;

/** Limits for building and keeping a package. */
export interface PackageSettings {
  /** An upload larger than this many megabytes is left out of the package. */
  maxFileMb: number;
  /** The largest package in megabytes; the job's own result limit applies when it is lower. */
  maxPackageMb: number;
  /** Days a package is kept, counted again each time its email step starts. */
  retentionDays: number;
}

/**
 * The settings in `source`. Unset or empty takes the default; any other value that is not a whole
 * number in range throws, naming the variable.
 */
export const resolvePackageSettings = (source: EnvSource): PackageSettings => ({
  maxFileMb: wholeNumberSetting(source, `${PREFIX}MAX_FILE_MB`, 25, { max: 1024 }),
  maxPackageMb: wholeNumberSetting(source, `${PREFIX}MAX_PACKAGE_MB`, 100, { max: 1024 }),
  retentionDays: wholeNumberSetting(source, `${PREFIX}RETENTION_DAYS`, 7, { max: 365 }),
});
