import { parseJson } from '@/src/shared/api/sobaHelpers';
import { sobaFetch } from '@/src/shared/api/sobaFetch';

export type DocumentTemplate = {
  id: string;
  fileId: string;
  formId: string;
  filename: string;
  contentType: string | null;
  size: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
};

export type DocumentGenerationConfiguration = {
  formId: string;
  printableName: string | null;
  defaultTemplateId: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type DocumentGenerationSettings = {
  configuration: DocumentGenerationConfiguration;
  templates: DocumentTemplate[];
};

const basePath = (formId: string) => `/design/forms/${formId}/document-generation`;

export async function getDocumentGenerationSettings(
  token: string,
  formId: string,
): Promise<DocumentGenerationSettings> {
  return parseJson(await sobaFetch(basePath(formId), { token }));
}

export async function uploadDocumentTemplate(
  token: string,
  formId: string,
  file: File,
): Promise<DocumentTemplate> {
  const formData = new FormData();
  formData.set('file', file);
  return parseJson(
    await sobaFetch(`${basePath(formId)}/templates`, {
      token,
      method: 'POST',
      formData,
    }),
  );
}

export async function updateDocumentGenerationSettings(
  token: string,
  formId: string,
  configuration: Pick<DocumentGenerationConfiguration, 'printableName' | 'defaultTemplateId'>,
): Promise<DocumentGenerationConfiguration> {
  return parseJson(
    await sobaFetch(`${basePath(formId)}/configuration`, {
      token,
      method: 'PUT',
      json: configuration,
    }),
  );
}

export async function deleteDocumentTemplate(
  token: string,
  formId: string,
  templateId: string,
): Promise<void> {
  const response = await sobaFetch(`${basePath(formId)}/templates/${templateId}`, {
    token,
    method: 'DELETE',
  });
  if (!response.ok) await parseJson(response);
}

export async function downloadDocumentTemplate(
  token: string,
  formId: string,
  template: DocumentTemplate,
): Promise<void> {
  const response = await sobaFetch(`${basePath(formId)}/templates/${template.id}/content`, {
    token,
  });
  if (!response.ok) await parseJson(response);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = template.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
