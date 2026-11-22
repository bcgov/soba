import {
  documentExtension,
  missingFilesText,
  packageName,
  uploadNamer,
} from '../../../src/plugins/post-submission-email-package/entries';

describe('packageName', () => {
  it('is the cleaned form name, cut to 100 characters, then the confirmation code', () => {
    expect(packageName('Permit: Intake/2026', 'ABC123')).toBe('Permit Intake 2026 ABC123');
    expect(packageName('x'.repeat(150), 'ABC123')).toBe(`${'x'.repeat(100)} ABC123`);
  });

  it('falls back to Submission for a name with nothing usable', () => {
    expect(packageName('///', 'ABC123')).toBe('Submission ABC123');
  });
});

describe('documentExtension', () => {
  it('is pdf for a PDF and txt for anything else', () => {
    expect(documentExtension('application/pdf')).toBe('pdf');
    expect(documentExtension('Application/PDF; charset=binary')).toBe('pdf');
    expect(documentExtension('text/plain')).toBe('txt');
    expect(documentExtension(undefined)).toBe('txt');
  });
});

describe('uploadNamer', () => {
  it('cleans each name and tells repeats apart before the extension, ignoring case', () => {
    const name = uploadNamer();
    expect(['plan.pdf', 'Plan.PDF', 'plan.pdf', 'a/b:c.png'].map(name)).toEqual([
      'plan.pdf',
      'Plan (2).PDF',
      'plan (3).pdf',
      'a b c.png',
    ]);
  });

  it('cuts a name to 100 characters before its extension, then tells the cut names apart', () => {
    const name = uploadNamer();
    const long = 'y'.repeat(120);
    expect(name(`${long}a.txt`)).toBe(`${'y'.repeat(100)}.txt`);
    expect(name(`${long}b.txt`)).toBe(`${'y'.repeat(100)} (2).txt`);
  });

  it('names an empty, "." or ".." name file, and keeps a leading dot as part of the name', () => {
    const name = uploadNamer();
    expect(['', '.', '..', '.env'].map(name)).toEqual(['file', 'file (2)', 'file (3)', '.env']);
  });

  it('cuts whole characters, never half of one', () => {
    const name = uploadNamer();
    expect(name(`${'a'.repeat(99)}😀b.pdf`)).toBe(`${'a'.repeat(99)}😀.pdf`);
    expect(name(`${'a'.repeat(99)}😀.pdf`)).toBe(`${'a'.repeat(99)}😀 (2).pdf`);
  });

  it('keeps a name within 240 bytes, so a long name in any script extracts', () => {
    const name = uploadNamer();
    const named = name(`${'漢'.repeat(100)}.pdf`);
    expect(Buffer.byteLength(named)).toBeLessThanOrEqual(240);
    expect(named.endsWith('.pdf')).toBe(true);
    expect(Buffer.byteLength(name(`${'漢'.repeat(100)}.pdf`))).toBeLessThanOrEqual(240);
  });

  it('drops the trailing dots and spaces Windows would, and guards its device names', () => {
    const name = uploadNamer();
    expect(['report. ', 'notes...', 'CON.txt', 'nul', 'Com1.log', 'console.txt'].map(name)).toEqual(
      ['report', 'notes', '_CON.txt', '_nul', '_Com1.log', 'console.txt'],
    );
  });

  it('treats a very long extension as part of the name', () => {
    const name = uploadNamer();
    const tail = 'x'.repeat(40);
    expect(name(`plan.${tail}`)).toBe(`plan.${tail}`);
  });
});

describe('packageName in bytes', () => {
  it('keeps the package name and its extension within 240 bytes', () => {
    const named = `${packageName('漢'.repeat(100), 'ABC123')}.zip`;
    expect(Buffer.byteLength(named)).toBeLessThanOrEqual(240);
    expect(named.endsWith(' ABC123.zip')).toBe(true);
  });
});

describe('missingFilesText', () => {
  it('lists each upload left out and why, in English and French', () => {
    expect(
      missingFilesText(
        [
          { name: 'old.pdf', reason: 'deleted' },
          { name: 'big\nvideo.mp4', reason: 'too-large' },
        ],
        25,
      ),
    ).toBe(
      [
        'Uploaded files not in this package / Fichiers téléversés absents de ce paquet',
        '',
        'old.pdf: deleted / supprimé',
        'big video.mp4: larger than 25 MB / plus de 25 Mo',
        '',
      ].join('\n'),
    );
  });
});
