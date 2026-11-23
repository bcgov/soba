import {
  attachmentName,
  documentExtension,
  missingFilesText,
  packageName,
  reportName,
} from '../../../src/plugins/post-submission-email-package/entries';

describe('packageName', () => {
  it('is the cleaned form name, cut to 100 characters, a hyphen, then the confirmation code', () => {
    expect(packageName('Permit: Intake/2026', 'ABC123')).toBe('Permit Intake 2026-ABC123');
    expect(packageName('x'.repeat(150), 'ABC123')).toBe(`${'x'.repeat(100)}-ABC123`);
  });

  it('falls back to Submission for a name with nothing usable', () => {
    expect(packageName('///', 'ABC123')).toBe('Submission-ABC123');
  });

  it('keeps the package name and its extension within 240 bytes', () => {
    const named = `${packageName('漢'.repeat(100), 'ABC123')}.zip`;
    expect(Buffer.byteLength(named)).toBeLessThanOrEqual(240);
    expect(named.endsWith('-ABC123.zip')).toBe(true);
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

describe('reportName', () => {
  it("is the template's name as staff set it, cleaned, a hyphen, then the confirmation code", () => {
    expect(reportName('Permit report', 'ABC123', 'application/pdf')).toBe(
      'Permit report-ABC123.pdf',
    );
    expect(reportName('Permit: report', 'ABC123', 'text/plain')).toBe('Permit report-ABC123.txt');
  });

  // A template's name is not a file name, so a dot in it is kept.
  it('keeps the whole name, a dot and what follows it included', () => {
    expect(reportName('Permit report v1.2', 'ABC123', 'application/pdf')).toBe(
      'Permit report v1.2-ABC123.pdf',
    );
  });

  it('falls back to Submission for a template name with nothing usable', () => {
    expect(reportName('///', 'ABC123', 'application/pdf')).toBe('Submission-ABC123.pdf');
  });
});

describe('attachmentName', () => {
  it('puts the position first, then the cleaned original name', () => {
    expect(attachmentName(1, 'plan.pdf')).toBe('1-plan.pdf');
    expect(attachmentName(2, 'plan.pdf')).toBe('2-plan.pdf');
    expect(attachmentName(12, 'a/b:c.png')).toBe('12-a b c.png');
  });

  it('cuts a name to 100 characters before its extension, whole characters only', () => {
    expect(attachmentName(1, `${'y'.repeat(120)}.txt`)).toBe(`1-${'y'.repeat(100)}.txt`);
    expect(attachmentName(1, `${'a'.repeat(99)}😀b.pdf`)).toBe(`1-${'a'.repeat(99)}😀.pdf`);
  });

  it('keeps a name within 240 bytes, so a long name in any script extracts', () => {
    const named = attachmentName(3, `${'漢'.repeat(100)}.pdf`);
    expect(Buffer.byteLength(named)).toBeLessThanOrEqual(240);
    expect(named.startsWith('3-')).toBe(true);
    expect(named.endsWith('.pdf')).toBe(true);
  });

  it('drops the trailing dots and spaces Windows would, and names an empty name file', () => {
    expect(
      ['report. ', 'notes...', '', '..', 'CON.txt'].map((name) => attachmentName(1, name)),
    ).toEqual(['1-report', '1-notes', '1-file', '1-file', '1-CON.txt']);
  });

  it('treats a leading dot, or a very long extension, as part of the name', () => {
    expect(attachmentName(1, '.env')).toBe('1-.env');
    const tail = 'x'.repeat(40);
    expect(attachmentName(1, `plan.${tail}`)).toBe(`1-plan.${tail}`);
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
