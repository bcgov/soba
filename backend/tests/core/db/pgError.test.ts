import { DrizzleQueryError } from 'drizzle-orm/errors';
import { isPgDataError } from '../../../src/core/db/pgError';

/** A Postgres error as the driver raises it, wrapped as Drizzle wraps it. */
const pgError = (code: string): Error =>
  new DrizzleQueryError(
    'insert into "soba"."job" ...',
    [],
    Object.assign(new Error('violates something'), { code, severity: 'ERROR' }),
  );

describe('isPgDataError', () => {
  it.each([
    ['a foreign key to a row that is gone', '23503'],
    ['a null in a column that takes none', '23502'],
    ['text that is not a uuid', '22P02'],
  ])('is true for %s, refused on every try', (_case, code) => {
    expect(isPgDataError(pgError(code))).toBe(true);
  });

  it.each([
    ['a serialization failure', '40001'],
    ['a statement timeout', '57014'],
    ['a lost connection', '08006'],
  ])('is false for %s, which another try can pass', (_case, code) => {
    expect(isPgDataError(pgError(code))).toBe(false);
  });

  it('is false for an error that is not from Postgres', () => {
    expect(isPgDataError(Object.assign(new Error('reset'), { code: 'ECONNRESET' }))).toBe(false);
    expect(isPgDataError('plain')).toBe(false);
  });
});
