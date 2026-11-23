import { cleanFileName } from '../../src/core/fileNames';

describe('cleanFileName', () => {
  it('turns characters file systems refuse into single spaces and trims the ends', () => {
    expect(cleanFileName(' Résumé: a/b\\c*?"<>|d ')).toBe('Résumé a b c d');
    expect(cleanFileName('tab\there\nnewline')).toBe('tab here newline');
  });

  it('leaves a usable name as it is, and an unusable one empty', () => {
    expect(cleanFileName('Permit (2).pdf')).toBe('Permit (2).pdf');
    expect(cleanFileName('///')).toBe('');
  });
});
