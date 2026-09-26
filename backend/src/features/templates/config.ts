import path from 'node:path';

/** Template file types the document generation backends render. */
export const TEMPLATE_EXTENSIONS: readonly string[] = [
  '.docx',
  '.xlsx',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
];

/** The accepted types for messages: "docx, xlsx, pptx, odt, ods, odp". */
export const TEMPLATE_TYPES = TEMPLATE_EXTENSIONS.map((ext) => ext.slice(1)).join(', ');

export const isTemplateFile = (filename: string): boolean =>
  TEMPLATE_EXTENSIONS.includes(path.extname(filename).toLowerCase());
