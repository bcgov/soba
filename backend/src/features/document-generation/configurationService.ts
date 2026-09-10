import path from 'node:path';
import { env } from '../../core/config/env';
import {
  createDocumentGenerationTemplate,
  getDocumentGenerationConfiguration,
  getDocumentGenerationTemplate,
  listDocumentGenerationTemplates,
  upsertDocumentGenerationConfiguration,
  type DocumentGenerationTemplateWithFile,
} from '../../core/db/repos/documentGenerationConfigRepo';
import { ValidationError, ServiceUnavailableError } from '../../core/errors';
import { filesService } from '../files/service';

const TEMPLATE_CONTENT_TYPES: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export interface TemplateUploadInput {
  formId: string;
  workspaceId: string;
  actorId: string;
  filename: string;
  contentType?: string;
  size?: number;
  buffer: Buffer;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export const documentGenerationConfigurationService = {
  async get(formId: string) {
    const [configuration, templates] = await Promise.all([
      getDocumentGenerationConfiguration(formId),
      listDocumentGenerationTemplates(formId),
    ]);
    return { configuration, templates };
  },

  async uploadTemplate(
    input: TemplateUploadInput,
  ): Promise<DocumentGenerationTemplateWithFile | 'infected' | 'scan-unavailable'> {
    const fileType = path.extname(input.filename).toLowerCase().slice(1);
    if (!TEMPLATE_CONTENT_TYPES[fileType]) {
      throw new ValidationError('Only DOCX, PDF, and XLSX document templates are supported');
    }
    const profile =
      env.getOptionalEnv('DOCUMENT_GENERATION_TEMPLATE_STORAGE_PROFILE') ??
      env.getFilesStorageProfile();
    const file = await filesService.upload({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      formId: input.formId,
      filename: input.filename,
      contentType: input.contentType ?? TEMPLATE_CONTENT_TYPES[fileType],
      size: input.size,
      buffer: input.buffer,
      useProfile: profile,
    });
    if (file === 'infected' || file === 'scan-unavailable') return file;

    try {
      const template = await createDocumentGenerationTemplate({
        formId: input.formId,
        fileId: file.id,
        actorId: input.actorId,
      });
      return { ...template, file };
    } catch (error) {
      await filesService.delete(file);
      throw error;
    }
  },

  async updateConfiguration(input: {
    formId: string;
    actorId: string;
    printableName: string | null;
    defaultTemplateId: string | null;
  }) {
    if (
      input.defaultTemplateId &&
      !(await getDocumentGenerationTemplate(input.formId, input.defaultTemplateId))
    ) {
      throw new ValidationError('Default template does not belong to this form');
    }
    return upsertDocumentGenerationConfiguration(input);
  },

  async deleteTemplate(formId: string, templateId: string): Promise<boolean> {
    const template = await getDocumentGenerationTemplate(formId, templateId);
    if (!template) return false;
    // Deleting the generic file cascades the template association and clears any default reference.
    await filesService.delete(template.file);
    return true;
  },

  async getTemplateFile(formId: string, templateId: string) {
    const template = await getDocumentGenerationTemplate(formId, templateId);
    if (!template) return null;
    const file = await filesService.get(template.file);
    if (file === 'notfound') return null;
    return { record: template.file, file };
  },

  async loadDefaultTemplate(formId: string): Promise<{
    template: Record<string, unknown>;
    printableName: string | null;
  } | null> {
    const configuration = await getDocumentGenerationConfiguration(formId);
    if (!configuration?.defaultTemplateId) return null;
    const stored = await getDocumentGenerationTemplate(formId, configuration.defaultTemplateId);
    if (!stored) return null;
    const file = await filesService.get(stored.file);
    if (file === 'notfound' || !file.downloadStream) {
      throw new ServiceUnavailableError('Configured document template is unavailable');
    }
    const content = await streamToBuffer(file.downloadStream);
    const fileType = path.extname(stored.file.filename).toLowerCase().slice(1);
    return {
      template: {
        content: content.toString('base64'),
        encodingType: 'base64',
        fileType,
      },
      printableName: configuration.printableName,
    };
  },
};
