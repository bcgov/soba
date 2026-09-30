import { randomInt } from 'node:crypto';
import { isUniqueViolationOn } from '../db/pgError';
import { SUBMISSION_CONFIRMATION_CODE_UNIQUE } from '../db/schema';

// Crockford base32: no I, L, O or U.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LENGTH = 8;
const MAX_ATTEMPTS = 3;

export const newConfirmationCode = (): string =>
  Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** Runs `write` with a new code, and again with another when the code is already taken. */
export async function withNewConfirmationCode<T>(write: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await write(newConfirmationCode());
    } catch (err) {
      if (!isUniqueViolationOn(err, SUBMISSION_CONFIRMATION_CODE_UNIQUE)) throw err;
    }
  }
  return write(newConfirmationCode());
}
