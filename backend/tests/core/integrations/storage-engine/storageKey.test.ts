import {
  isStoragePrefix,
  storedFileName,
} from '../../../../src/core/integrations/storage-engine/storageKey';

describe('isStoragePrefix', () => {
  it.each(['attachments', 'templates', 'soba-dev', 'soba/dev', 'pr-156/templates', 'v2'])(
    'accepts %s',
    (value) => {
      expect(isStoragePrefix(value)).toBe(true);
    },
  );

  it.each([
    '',
    '../escape',
    'a/../b',
    '/leading',
    'trailing/',
    'Upper',
    'two--dashes',
    'sp ace',
    'a//b',
  ])('refuses %j', (value) => {
    expect(isStoragePrefix(value)).toBe(false);
  });
});

describe('storedFileName', () => {
  const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}';

  it('puts a uuid v7 before the name', () => {
    expect(storedFileName('receipt.docx')).toMatch(new RegExp(`^${UUID}-receipt\\.docx$`));
  });

  it('gives the same name a different stored name each time', () => {
    expect(storedFileName('receipt.docx')).not.toBe(storedFileName('receipt.docx'));
  });

  it('keeps only the last segment of a name with slashes', () => {
    expect(storedFileName('nested/dir/name.txt')).toMatch(new RegExp(`^${UUID}-name\\.txt$`));
    expect(storedFileName('../../escape.txt')).toMatch(new RegExp(`^${UUID}-escape\\.txt$`));
  });

  it('names an unnamed file "file"', () => {
    expect(storedFileName('')).toMatch(new RegExp(`^${UUID}-file$`));
  });
});
