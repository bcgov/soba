import { z } from 'zod';

/** The address rule every notification send is checked against. */
export const EmailAddressSchema = z.email();

/** One address as Soba keeps it: trimmed, lower-cased, then checked. */
export const NormalizedEmailAddressSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(EmailAddressSchema);
