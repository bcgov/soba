export type SobaFormType = {
  name: string;
  description: string;
  formEngineCode?: string;
  visibility?: string[];
};

export type CreateSobaFormioFormResponse = {
  createdAt: Date;
  description: string;
  id: string;
  name: string;
  status: string;
  updatedAt: Date;
  // POST /forms now returns the form plus its initial v1 draft (FormWithVersionResponse).
  formVersion?: SobaFormVersionType | null;
};

export type SobaResponseFormType = {
  id: string;
  name: string;
  description: string;
  formEngineCode?: string;
};

export type SobaFormVersionType = {
  id: string;
  versionNo: number;
  state: string;
  engineSyncStatus: string;
  engineSchemaRef?: string | null;
  currentRevisionNo: number;
  publishedAt?: string | null;
  visibility?: string[];
  createdAt: string;
  updatedAt: string;
};
