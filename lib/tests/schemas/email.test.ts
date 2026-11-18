import { NormalizedEmailAddressSchema } from '../../src/schemas/email';

describe('NormalizedEmailAddressSchema', () => {
  it('trims and lower-cases an address', () => {
    expect(NormalizedEmailAddressSchema.parse('  Pat.Lee@Example.GOV.bc.ca ')).toBe(
      'pat.lee@example.gov.bc.ca',
    );
  });

  // Trimmed before it is checked, so whitespace alone is no address.
  it.each([
    ['an empty string', ''],
    ['whitespace', '   '],
    ['no domain', 'pat@'],
    ['no at sign', 'pat.example.com'],
    ['two addresses', 'a@example.com, b@example.com'],
    ['a non-string', 42],
  ])('rejects %s', (_label, value) => {
    expect(NormalizedEmailAddressSchema.safeParse(value).success).toBe(false);
  });

  it('accepts an address of the longest length and refuses one longer', () => {
    const local = (length: number) => 'a'.repeat(length - '@example.com'.length);
    expect(NormalizedEmailAddressSchema.safeParse(`${local(254)}@example.com`).success).toBe(true);
    expect(NormalizedEmailAddressSchema.safeParse(`${local(255)}@example.com`).success).toBe(false);
  });

  // The format check alone overflows the stack on a value this long.
  it('refuses a value megabytes long without throwing', () => {
    const huge = `a@a${'.a'.repeat(2_600_000)}`;
    expect(() => NormalizedEmailAddressSchema.safeParse(huge)).not.toThrow();
    expect(NormalizedEmailAddressSchema.safeParse(huge).success).toBe(false);
  });
});
