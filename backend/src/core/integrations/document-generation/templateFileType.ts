import path from 'node:path';
import { isTemplateFileType, TEMPLATE_FILE_TYPES, type TemplateFileType } from '@soba/lib';

export { TEMPLATE_FILE_TYPES };
export type { TemplateFileType };

/** The template type of a file name, from its extension; null when it is not a template type. */
export const templateFileType = (filename: string): TemplateFileType | null => {
  const extension = path.extname(filename).slice(1).toLowerCase();
  return isTemplateFileType(extension) ? extension : null;
};
