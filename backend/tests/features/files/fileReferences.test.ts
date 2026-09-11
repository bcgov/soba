import { extractChefsFileIds } from '../../../src/features/files/fileReferences';

describe('extractChefsFileIds', () => {
  it('collects ids from chefs file values nested in arrays and objects', () => {
    const data = {
      attachment: [
        { storage: 'chefs', id: 'a', name: 'a.pdf' },
        { storage: 'chefs', id: 'b', name: 'b.pdf' },
      ],
      nested: { more: [{ storage: 'chefs', id: 'c' }] },
    };
    expect(extractChefsFileIds(data).sort()).toEqual(['a', 'b', 'c']);
  });

  it('ignores non-chefs storage and non-file values, and dedupes', () => {
    const data = {
      other: [{ storage: 'url', id: 'x' }],
      text: 'hello',
      num: 5,
      dup: [
        { storage: 'chefs', id: 'a' },
        { storage: 'chefs', id: 'a' },
      ],
    };
    expect(extractChefsFileIds(data)).toEqual(['a']);
  });

  it('handles null/undefined/primitive/empty input', () => {
    expect(extractChefsFileIds(null)).toEqual([]);
    expect(extractChefsFileIds(undefined)).toEqual([]);
    expect(extractChefsFileIds('str')).toEqual([]);
    expect(extractChefsFileIds({})).toEqual([]);
  });

  it('ignores chefs objects without a non-empty string id', () => {
    const data = {
      f: [{ storage: 'chefs' }, { storage: 'chefs', id: 123 }, { storage: 'chefs', id: '' }],
    };
    expect(extractChefsFileIds(data)).toEqual([]);
  });
});
