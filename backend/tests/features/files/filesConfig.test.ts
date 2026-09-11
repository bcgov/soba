import {
  isBlockedExtension,
  getFilesConfig,
  BLOCKED_FILE_EXTENSIONS,
} from '../../../src/features/files/config';

describe('files config', () => {
  it('blocks dangerous extensions (case-insensitive)', () => {
    expect(isBlockedExtension('malware.exe')).toBe(true);
    expect(isBlockedExtension('script.SH')).toBe(true);
    expect(isBlockedExtension('page.HtMl')).toBe(true);
  });

  it('allows normal document/image extensions and extensionless names', () => {
    expect(isBlockedExtension('report.pdf')).toBe(false);
    expect(isBlockedExtension('photo.png')).toBe(false);
    expect(isBlockedExtension('data.csv')).toBe(false);
    expect(isBlockedExtension('noextension')).toBe(false);
  });

  it('checks only the final extension', () => {
    expect(isBlockedExtension('archive.exe.pdf')).toBe(false); // final ext .pdf
    expect(isBlockedExtension('report.pdf.exe')).toBe(true); // final ext .exe
  });

  it('exposes the size limit and the blocked list', () => {
    const cfg = getFilesConfig();
    expect(typeof cfg.maxFileSizeMb).toBe('number');
    expect(cfg.blockedExtensions).toEqual([...BLOCKED_FILE_EXTENSIONS]);
  });
});
