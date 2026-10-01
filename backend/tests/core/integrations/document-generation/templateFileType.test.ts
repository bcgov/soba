import { templateFileType } from '../../../../src/core/integrations/document-generation/templateFileType';

describe('templateFileType', () => {
  it.each([
    ['r.docx', 'docx'],
    ['R.DOCX', 'docx'],
    ['sheet.xlsx', 'xlsx'],
  ])('reads %s as %s', (name, type) => {
    expect(templateFileType(name)).toBe(type);
  });

  it.each(['r.doc', 'r.pdf', 'r.docx.exe', 'docx', 'r.txt', ''])('refuses %j', (name) => {
    expect(templateFileType(name)).toBeNull();
  });
});
