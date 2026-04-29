export type SobaFormType = {
  slug: string;
  name: string;
  description: string;
  formEngineCode?: string;
};

export type CreateSobaFormioFormResponse = {
  createdAt: Date;
  description: string;
  id: string;
  name: string;
  slug: string;
  status: string;
  updatedAt: Date;
};

export type SobaResponseFormType = {
  id: string;
  slug: string;
  name: string;
  description: string;
  formEngineCode?: string;
};

export type SobaFormWithVersionResponse = SobaResponseFormType & {
  formVersion?: {
    id: string;
    formId: string;
    versionNo: number;
    state: string;
    engineSyncStatus: string;
    engineSchemaRef?: string | null;
    currentRevisionNo: number;
    publishedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};
