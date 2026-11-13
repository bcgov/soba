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
});
