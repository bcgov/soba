import type {
  CreateFormBody,
  UpdateFormBody,
  FormListItem,
  FormResponse,
  FormVersionListItem,
  FormVersionResponse,
  FormWithVersionResponse,
} from '@soba/lib';

export type {
  FormWithPermissionsResponse,
  ListFormsResponse,
  ListFormVersionsResponse,
  SubmitFillBundle,
  SubmissionDataDocument,
} from '@soba/lib';

export type {
  CreateFormBody,
  UpdateFormBody,
  FormListItem,
  FormResponse,
  FormVersionListItem,
  FormVersionResponse,
  FormWithVersionResponse,
};

export type SobaFormType = Partial<CreateFormBody> & Partial<UpdateFormBody>;

export type CreateSobaFormioFormResponse = FormWithVersionResponse;

export type SobaResponseFormType = FormResponse;

export type SobaFormSummary = FormListItem;

export type SobaFormVersionType = FormVersionResponse;

export type SobaFormVersionListItem = FormVersionListItem;

