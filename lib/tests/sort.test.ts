import { compareTextForSort, matchesSearchTerm, type TextSortRules } from '../src/sort';

const order = (list: (string | null | undefined)[], dir: 'asc' | 'desc', rules: TextSortRules) =>
  [...list].sort((a, b) => compareTextForSort(a, b, dir, rules));

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
  const ci = { caseInsensitive: true };

  it('reproduces the database order for accented, mixed-case text', () => {
    expect(order([...dbOrder].reverse(), 'asc', ci)).toEqual(dbOrder);
  });

  it('reverses that order descending', () => {
    expect(order(dbOrder, 'desc', ci)).toEqual([...dbOrder].reverse());
  });

  it('sorts missing values last in both directions', () => {
    const rows = ['b', null, 'a', undefined];
    const asc = order(rows, 'asc', { nullable: true });
    const desc = order(rows, 'desc', { nullable: true });
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
  // [what it checks, value, term, expected]. Mirrors ilike: case insensitive, literal wildcards,
  // no accent folding, empty term matches all, missing value matches nothing.
  const cases: [string, string | null | undefined, string, boolean][] = [
    ['case-insensitive substring hit', 'Budget Report', 'budget', true],
    ['substring miss', 'Budget Report', 'xyz', false],
    ['percent is literal and present', '50% off', '50%', true],
    ['percent is literal and absent', '50 off', '%', false],
    ['accent kept, exact hit', 'café', 'café', true],
    ['accent not folded to plain', 'café', 'cafe', false],
    ['empty term matches anything', 'anything', '', true],
    ['null value matches nothing', null, 'x', false],
    ['undefined value matches nothing', undefined, 'x', false],
  ];

  it.each(cases)('%s', (_label, value, term, expected) => {
    expect(matchesSearchTerm(value, term)).toBe(expected);
  });
});
