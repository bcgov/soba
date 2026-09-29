import path from 'node:path';

/** Template file types the document generation backends render. */
export const TEMPLATE_FILE_TYPES = ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'] as const;

export type TemplateFileType = (typeof TEMPLATE_FILE_TYPES)[number];

const isTemplateFileType = (value: string): value is TemplateFileType =>
  (TEMPLATE_FILE_TYPES as readonly string[]).includes(value);

/** The template type of a file name, from its extension; null when it is not a template type. */
export const templateFileType = (filename: string): TemplateFileType | null => {
  const extension = path.extname(filename).slice(1).toLowerCase();
  return isTemplateFileType(extension) ? extension : null;
};
