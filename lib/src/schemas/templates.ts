import { z } from 'zod';

/** Template file types the document generation backends render. */
export const TEMPLATE_FILE_TYPES = ['docx', 'xlsx', 'html'] as const;

export type TemplateFileType = (typeof TEMPLATE_FILE_TYPES)[number];

/** The accepted types as prose: "docx, xlsx, html". */
export const TEMPLATE_TYPES = TEMPLATE_FILE_TYPES.join(', ');

/** `accept` value for a file input that takes a template. */
export const TEMPLATE_FILE_ACCEPT = TEMPLATE_FILE_TYPES.map((type) => `.${type}`).join(',');

export const isTemplateFileType = (value: string): value is TemplateFileType =>
  (TEMPLATE_FILE_TYPES as readonly string[]).includes(value);

export const TemplateIdParamsSchema = z.object({ id: z.uuid() });

/** Templates are addressed by the form version they belong to. */
export const TemplatesQuerySchema = z.object({ formVersionId: z.uuid() });

export const TemplateNameBodySchema = z.object({ name: z.string().trim().min(1).max(100) });

/** A document template: the record's own fields plus those of the file it wraps. */
export const TemplateResponseSchema = z.object({
  id: z.uuid(),
  formId: z.uuid(),
  formVersionId: z.uuid(),
  name: z.string(),
  filename: z.string(),
  contentType: z.string().nullable(),
  size: z.number().int().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedBy: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export const TemplateListResponseSchema = z.object({ items: z.array(TemplateResponseSchema) });

export type TemplateIdParams = z.infer<typeof TemplateIdParamsSchema>;
export type TemplatesQuery = z.infer<typeof TemplatesQuerySchema>;
export type TemplateNameBody = z.infer<typeof TemplateNameBodySchema>;
export type TemplateResponse = z.infer<typeof TemplateResponseSchema>;
export type TemplateListResponse = z.infer<typeof TemplateListResponseSchema>;
