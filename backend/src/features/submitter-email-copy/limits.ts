import { wholeNumberSetting, type EnvSource } from '../../core/config/env';

/** What a submitter email copy is counted against, narrowest first. */
export const EMAIL_COPY_SCOPES = [
  'submission',
  'recipient',
  'form',
  'workspace',
  'environment',
] as const;
export type EmailCopyScope = (typeof EMAIL_COPY_SCOPES)[number];

/** Copies allowed per hour, for each scope. */
export type EmailCopyHourlyLimits = Record<EmailCopyScope, number>;

const DEFAULTS: EmailCopyHourlyLimits = {
  submission: 5,
  recipient: 10,
  form: 500,
  workspace: 2000,
  environment: 5000,
};
const MAX_LIMIT = 1_000_000;

const variable = (scope: EmailCopyScope) =>
  `SUBMITTER_EMAIL_COPY_${scope.toUpperCase()}_HOURLY_LIMIT`;

/**
 * The limits from SUBMITTER_EMAIL_COPY_*_HOURLY_LIMIT; unset or empty uses the default. A value
 * that is not a whole number from 1 to 1000000 throws, naming the variable, so it stops the start.
 */
export const readEmailCopyLimits = (source: EnvSource = process.env): EmailCopyHourlyLimits =>
  Object.fromEntries(
    EMAIL_COPY_SCOPES.map((scope) => [
      scope,
      wholeNumberSetting(source, variable(scope), DEFAULTS[scope], { max: MAX_LIMIT }),
    ]),
  ) as EmailCopyHourlyLimits;

/** The first scope whose count has reached its limit, so one more would pass it; or null. */
export const exceededEmailCopyLimit = (
  counts: Readonly<Record<EmailCopyScope, number>>,
  limits: EmailCopyHourlyLimits,
): EmailCopyScope | null =>
  EMAIL_COPY_SCOPES.find((scope) => counts[scope] >= limits[scope]) ?? null;
