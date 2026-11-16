import { z } from 'zod';

/** The address rule every notification send is checked against. */
export const EmailAddressSchema = z.email();

/** The longest address a mail system accepts. */
export const EMAIL_ADDRESS_MAX_LENGTH = 254;

/** One address as Soba keeps it: trimmed, lower-cased, then checked. */
export const NormalizedEmailAddressSchema = z
  .string()
  .trim()
  // Before the format check, which overflows the stack on a value megabytes long.
  .max(EMAIL_ADDRESS_MAX_LENGTH)
  .toLowerCase()
  .pipe(EmailAddressSchema);
