import { templateFileType } from '../../core/integrations/document-generation/templateFileType';

/** The accepted types for messages: "docx, xlsx, html". */
export { TEMPLATE_TYPES } from '@soba/lib';

export const isTemplateFile = (filename: string): boolean => templateFileType(filename) !== null;
