import path from 'node:path';
import { isTemplateFileType, type TemplateFileType } from '@soba/lib';

export { TEMPLATE_FILE_TYPES } from '@soba/lib';
export type { TemplateFileType } from '@soba/lib';

/** The template type of a file name, from its extension; null when it is not a template type. */
export const templateFileType = (filename: string): TemplateFileType | null => {
  const extension = path.extname(filename).slice(1).toLowerCase();
  return isTemplateFileType(extension) ? extension : null;
};
