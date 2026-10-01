import {
  TEMPLATE_FILE_ACCEPT,
  TEMPLATE_FILE_TYPES,
  TEMPLATE_TYPES,
  TemplateNameBodySchema,
  TemplateResponseSchema,
  TemplatesQuerySchema,
  isTemplateFileType,
} from '../../src/schemas/templates';

describe('template schemas and shared values', () => {
  it('exposes the supported file types in UI-friendly forms', () => {
    expect(TEMPLATE_FILE_TYPES).toEqual(['docx', 'xlsx', 'html']);
    expect(TEMPLATE_TYPES).toBe('docx, xlsx, html');
    expect(TEMPLATE_FILE_ACCEPT).toBe('.docx,.xlsx,.html');
    expect(isTemplateFileType('html')).toBe(true);
    expect(isTemplateFileType('pdf')).toBe(false);
  });

  it('requires a UUID form version in template queries', () => {
    expect(
      TemplatesQuerySchema.safeParse({
        formVersionId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
    expect(TemplatesQuerySchema.safeParse({ formVersionId: 'not-a-uuid' }).success).toBe(false);
  });

  it('trims and bounds template names', () => {
    expect(TemplateNameBodySchema.parse({ name: '  Annual report  ' })).toEqual({
      name: 'Annual report',
    });
    expect(TemplateNameBodySchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(TemplateNameBodySchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false);
  });

  it('validates template response metadata', () => {
    const response = {
      id: '11111111-1111-4111-8111-111111111111',
      formId: '22222222-2222-4222-8222-222222222222',
      formVersionId: '33333333-3333-4333-8333-333333333333',
      name: 'Annual report',
      filename: 'report.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 512,
      createdBy: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedBy: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(TemplateResponseSchema.safeParse(response).success).toBe(true);
    expect(TemplateResponseSchema.safeParse({ ...response, size: '512' }).success).toBe(false);
  });
});
