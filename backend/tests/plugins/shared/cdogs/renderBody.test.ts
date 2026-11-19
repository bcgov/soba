import { toCdogsRenderBody } from '../../../../src/plugins/shared/cdogs/renderBody';
import type { DocumentRenderRequest } from '../../../../src/core/integrations/document-generation/DocumentGenerationAdapter';

const content = Buffer.from('template bytes');
const context = {
  status: 'unsaved',
  printedAt: '2026-11-12T18:00:00.000Z',
  confirmationCode: null,
  revisionNo: null,
} as const;

const request = (overrides: Partial<DocumentRenderRequest> = {}): DocumentRenderRequest => ({
  template: { content, fileType: 'docx' },
  options: {},
  data: {},
  context,
  ...overrides,
});

describe('toCdogsRenderBody', () => {
  it('sends the template as base64 with its file type', () => {
    const body = toCdogsRenderBody(request({ template: { content, fileType: 'xlsx' } }));
    expect(body.template).toEqual({
      content: content.toString('base64'),
      encodingType: 'base64',
      fileType: 'xlsx',
    });
  });

  it('carries only the CDOGS fields, with no Buffer left to serialize', () => {
    const body = toCdogsRenderBody(request());
    expect(Object.keys(body).sort()).toEqual(['data', 'options', 'template']);
    expect(JSON.stringify(body)).not.toContain('"type":"Buffer"');
  });

  it('forces overwrite:true while preserving other options', () => {
    const body = toCdogsRenderBody(request({ options: { reportName: 'r' } }));
    expect(body.options).toEqual({ reportName: 'r', overwrite: true });
  });

  it('flattens the form-engine .data wrapper so templates use {d.field}', () => {
    const body = toCdogsRenderBody(request({ data: { data: { textField: 'saved' }, form: 'f' } }));
    expect(body.data).toEqual({ textField: 'saved', $chefs: context });
  });

  it('passes already-flat data through unchanged', () => {
    const body = toCdogsRenderBody(request({ data: { textField: 'live' } }));
    expect(body.data).toEqual({ textField: 'live', $chefs: context });
  });

  it('puts the print context where templates read it, over any answer of that name', () => {
    const body = toCdogsRenderBody(request({ data: { data: { $chefs: 'answer' } } }));
    expect(body.data).toEqual({ $chefs: context });
  });
});
