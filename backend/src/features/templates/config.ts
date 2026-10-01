import { TEMPLATE_TYPES } from '@soba/lib';
import { templateFileType } from '../../core/integrations/document-generation/templateFileType';

/** The accepted types for messages: "docx, xlsx, pptx, odt, ods, odp". */
export { TEMPLATE_TYPES };

export const isTemplateFile = (filename: string): boolean => templateFileType(filename) !== null;
