import { compareTextForSort, matchesSearchTerm } from '../src/sort';

describe('compareTextForSort', () => {
  // Expected order captured from the en_US.utf8 database with `ORDER BY lower(x)`: accents sort by
  // code point (cafz before cafe-acute, a-ring after z), which is what the code-unit compare must
  // reproduce so a client list matches the server. A locale comparator would interleave the accents.
  const dbOrder = [
    'Andrew',
    'apple',
    'Banana',
    'cafe',
    'cafz',
    'café',
    'naive',
    'naïve',
    'Zebra',
    'Zulu',
    'Ångström',
  ];

  it('reproduces the database order for accented, mixed-case text', () => {
    const shuffled = [
      'café',
      'Zulu',
      'Andrew',
      'naïve',
      'cafz',
      'Ångström',
      'apple',
      'cafe',
      'Banana',
      'naive',
      'Zebra',
    ];
    const sorted = [...shuffled].sort((a, b) =>
      compareTextForSort(a, b, 'asc', { caseInsensitive: true }),
    );
    expect(sorted).toEqual(dbOrder);
  });

  it('reverses that order descending', () => {
    const sorted = [...dbOrder].sort((a, b) =>
      compareTextForSort(a, b, 'desc', { caseInsensitive: true }),
    );
    expect(sorted).toEqual([...dbOrder].reverse());
  });

  it('sorts missing values last in both directions', () => {
    const rows = ['b', null, 'a', undefined];
    const asc = [...rows].sort((a, b) => compareTextForSort(a, b, 'asc', { nullable: true }));
    const desc = [...rows].sort((a, b) => compareTextForSort(a, b, 'desc', { nullable: true }));
    expect(asc.slice(0, 2)).toEqual(['a', 'b']);
    expect(asc.slice(2).every((v) => v == null)).toBe(true);
    expect(desc.slice(0, 2)).toEqual(['b', 'a']);
    expect(desc.slice(2).every((v) => v == null)).toBe(true);
  });

  it('compares as-is without folding when not case insensitive', () => {
    // Matches an ASCII enum column's default sort: uppercase sorts before lowercase by code point.
    expect(compareTextForSort('Beta', 'alpha', 'asc')).toBeLessThan(0);
  });
});

describe('matchesSearchTerm', () => {
  it('matches a case-insensitive substring', () => {
    expect(matchesSearchTerm('Budget Report', 'budget')).toBe(true);
    expect(matchesSearchTerm('Budget Report', 'xyz')).toBe(false);
  });

  it('treats wildcards as literal characters', () => {
    expect(matchesSearchTerm('50% off', '50%')).toBe(true);
    expect(matchesSearchTerm('50 off', '%')).toBe(false);
  });

  it('does not fold accents, matching ilike', () => {
    expect(matchesSearchTerm('café', 'café')).toBe(true);
    expect(matchesSearchTerm('café', 'cafe')).toBe(false);
  });

  it('matches everything on an empty term and nothing on a missing value', () => {
    expect(matchesSearchTerm('anything', '')).toBe(true);
    expect(matchesSearchTerm(null, 'x')).toBe(false);
    expect(matchesSearchTerm(undefined, 'x')).toBe(false);
  });
});
