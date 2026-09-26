import {
  TEMPLATE_FILE_TYPES,
  templateFileType,
} from '../../core/integrations/document-generation/templateFileType';

/** The accepted types for messages: "docx, xlsx, pptx, odt, ods, odp". */
export const TEMPLATE_TYPES = TEMPLATE_FILE_TYPES.join(', ');

export const isTemplateFile = (filename: string): boolean => templateFileType(filename) !== null;
