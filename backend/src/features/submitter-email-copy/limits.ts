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
const MIN_LIMIT = 1;
const MAX_LIMIT = 1_000_000;

const variable = (scope: EmailCopyScope) =>
  `SUBMITTER_EMAIL_COPY_${scope.toUpperCase()}_HOURLY_LIMIT`;

/**
 * The limits from SUBMITTER_EMAIL_COPY_*_HOURLY_LIMIT; unset or empty uses the default. A value out
 * of range throws, naming the variable, so a bad setting stops the start.
 */
export const readEmailCopyLimits = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): EmailCopyHourlyLimits => {
  const read = (scope: EmailCopyScope): number => {
    const raw = source[variable(scope)]?.trim();
    if (!raw) return DEFAULTS[scope];
    const value = Number(raw);
    if (!Number.isInteger(value) || value < MIN_LIMIT || value > MAX_LIMIT) {
      throw new Error(
        `${variable(scope)} must be a whole number from ${MIN_LIMIT} to ${MAX_LIMIT}, got '${raw}'`,
      );
    }
    return value;
  };
  return Object.fromEntries(
    EMAIL_COPY_SCOPES.map((scope) => [scope, read(scope)]),
  ) as EmailCopyHourlyLimits;
};

/** The first scope whose count has reached its limit, so one more would pass it; or null. */
export const exceededEmailCopyLimit = (
  counts: Readonly<Record<EmailCopyScope, number>>,
  limits: EmailCopyHourlyLimits,
): EmailCopyScope | null =>
  EMAIL_COPY_SCOPES.find((scope) => counts[scope] >= limits[scope]) ?? null;
