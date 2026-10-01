import { isTemplateFile } from '../../../src/features/templates/config';

describe('isTemplateFile', () => {
  it.each(['r.docx', 'R.DOCX', 'sheet.xlsx', 'site.html'])('accepts %s', (name) => {
    expect(isTemplateFile(name)).toBe(true);
  });

  it.each(['r.doc', 'r.pdf', 'r.docx.exe', 'docx', 'r.txt', ''])('refuses %s', (name) => {
    expect(isTemplateFile(name)).toBe(false);
  });
});
