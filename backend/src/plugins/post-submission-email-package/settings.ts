import { POST_SUBMISSION_EMAIL_PACKAGE_CODE } from '@soba/lib';
import { type EnvSource, wholeNumberSetting } from '../../core/config/env';
import { normalizeKey } from '../../core/config/pluginConfig';

const PREFIX = `PLUGIN_${normalizeKey(POST_SUBMISSION_EMAIL_PACKAGE_CODE)}_`;

/** How long a package is kept. */
export interface PackageSettings {
  /** Days a package is kept, counted again each time its email step starts. */
  retentionDays: number;
}

/**
 * The settings in `source`. Unset or empty takes the default; any other value that is not a whole
 * number from 1 to 365 throws, naming the variable.
 */
export const resolvePackageSettings = (source: EnvSource): PackageSettings => ({
  retentionDays: wholeNumberSetting(source, `${PREFIX}RETENTION_DAYS`, 7, { max: 365 }),
});
