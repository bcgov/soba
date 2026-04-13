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
