import { Readable } from 'node:stream';

jest.mock('../../../src/core/config/env', () => ({
  env: {
    getOptionalEnv: jest.fn().mockReturnValue('templates'),
    getFilesStorageProfile: jest.fn().mockReturnValue('default'),
  },
}));
jest.mock('../../../src/core/db/repos/documentGenerationConfigRepo', () => ({
  createDocumentGenerationTemplate: jest.fn(),
  getDocumentGenerationConfiguration: jest.fn(),
  getDocumentGenerationTemplate: jest.fn(),
  listDocumentGenerationTemplates: jest.fn(),
  upsertDocumentGenerationConfiguration: jest.fn(),
}));
jest.mock('../../../src/features/files/service', () => ({
  filesService: {
    upload: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  },
}));

import * as repo from '../../../src/core/db/repos/documentGenerationConfigRepo';
import { filesService } from '../../../src/features/files/service';
import { documentGenerationConfigurationService } from '../../../src/features/document-generation/configurationService';

const createTemplate = repo.createDocumentGenerationTemplate as jest.Mock;
const getConfiguration = repo.getDocumentGenerationConfiguration as jest.Mock;
const getTemplate = repo.getDocumentGenerationTemplate as jest.Mock;
const upsertConfiguration = repo.upsertDocumentGenerationConfiguration as jest.Mock;
const uploadFile = filesService.upload as jest.Mock;
const getFile = filesService.get as jest.Mock;
const deleteFile = filesService.delete as jest.Mock;

const file = {
  id: 'file-id',
  workspaceId: 'workspace-id',
  formId: 'form-id',
  submissionId: null,
  profile: 'templates',
  backendRef: 'local:template.docx',
  filename: 'template.docx',
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  size: 8,
  createdBy: 'actor-id',
  createdAt: new Date(),
  updatedBy: 'actor-id',
  updatedAt: new Date(),
};
const template = {
  id: 'template-id',
  formId: 'form-id',
  fileId: file.id,
  createdBy: 'actor-id',
  createdAt: new Date(),
  updatedBy: 'actor-id',
  updatedAt: new Date(),
  file,
};

describe('documentGenerationConfigurationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['docx', 'pdf', 'xlsx'])(
    'uploads a %s template and creates its form association',
    async (extension) => {
      uploadFile.mockResolvedValue({ ...file, filename: `template.${extension}` });
      createTemplate.mockResolvedValue(template);

      const result = await documentGenerationConfigurationService.uploadTemplate({
        formId: 'form-id',
        workspaceId: 'workspace-id',
        actorId: 'actor-id',
        filename: `template.${extension}`,
        buffer: Buffer.from('template'),
      });

      expect(uploadFile).toHaveBeenCalledWith(expect.objectContaining({ useProfile: 'templates' }));
      expect(createTemplate).toHaveBeenCalledWith({
        formId: 'form-id',
        fileId: 'file-id',
        actorId: 'actor-id',
      });
      expect(result).toEqual({
        ...template,
        file: { ...file, filename: `template.${extension}` },
      });
    },
  );

  it('retrieves a template file for download', async () => {
    getTemplate.mockResolvedValue(template);
    getFile.mockResolvedValue({ engineFileRef: file.backendRef, filename: file.filename });

    await expect(
      documentGenerationConfigurationService.getTemplateFile('form-id', 'template-id'),
    ).resolves.toEqual({
      record: file,
      file: { engineFileRef: file.backendRef, filename: file.filename },
    });
  });

  it('rejects unsupported templates before storing bytes', async () => {
    await expect(
      documentGenerationConfigurationService.uploadTemplate({
        formId: 'form-id',
        workspaceId: 'workspace-id',
        actorId: 'actor-id',
        filename: 'template.txt',
        buffer: Buffer.from('text'),
      }),
    ).rejects.toThrow('Only DOCX, PDF, and XLSX document templates are supported');
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('requires the default template to belong to the configured form', async () => {
    getTemplate.mockResolvedValue(null);
    await expect(
      documentGenerationConfigurationService.updateConfiguration({
        formId: 'form-id',
        actorId: 'actor-id',
        printableName: 'Permit',
        defaultTemplateId: 'other-template-id',
      }),
    ).rejects.toThrow('Default template does not belong to this form');
    expect(upsertConfiguration).not.toHaveBeenCalled();
  });

  it('loads the configured template as a CDOGS base64 payload', async () => {
    getConfiguration.mockResolvedValue({
      formId: 'form-id',
      defaultTemplateId: 'template-id',
      printableName: 'Permit',
    });
    getTemplate.mockResolvedValue(template);
    getFile.mockResolvedValue({
      engineFileRef: file.backendRef,
      filename: file.filename,
      downloadStream: Readable.from(Buffer.from('template')),
    });

    await expect(
      documentGenerationConfigurationService.loadDefaultTemplate('form-id'),
    ).resolves.toEqual({
      template: {
        content: Buffer.from('template').toString('base64'),
        encodingType: 'base64',
        fileType: 'docx',
      },
      printableName: 'Permit',
    });
  });

  it('uses the configured template extension in the CDOGS payload', async () => {
    getConfiguration.mockResolvedValue({
      formId: 'form-id',
      defaultTemplateId: 'template-id',
      printableName: null,
    });
    getTemplate.mockResolvedValue({
      ...template,
      file: { ...file, filename: 'template.xlsx' },
    });
    getFile.mockResolvedValue({
      engineFileRef: file.backendRef,
      filename: 'template.xlsx',
      downloadStream: Readable.from(Buffer.from('template')),
    });

    const result = await documentGenerationConfigurationService.loadDefaultTemplate('form-id');

    expect(result?.template.fileType).toBe('xlsx');
  });

  it('deletes both the template association and generic file', async () => {
    getTemplate.mockResolvedValue(template);
    await expect(
      documentGenerationConfigurationService.deleteTemplate('form-id', 'template-id'),
    ).resolves.toBe(true);
    expect(deleteFile).toHaveBeenCalledWith(file);
  });
});
