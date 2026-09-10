
import type {
  CreateFormBody,
  UpdateFormBody,
  FormResponse,
  FormVersionResponse,
  FormWithVersionResponse,
} from '@soba/lib';

export type { FormWithPermissionsResponse, ListFormsResponse } from '@soba/lib';

export type {
  CreateFormBody,
  UpdateFormBody,
  FormResponse,
  FormVersionResponse,
  FormWithVersionResponse,
};

export type SobaFormType = Partial<CreateFormBody> & Partial<UpdateFormBody>;

export type CreateSobaFormioFormResponse = FormWithVersionResponse;

export type SobaResponseFormType = FormResponse;

export type SobaFormVersionType = FormVersionResponse;

// Submit-mode payload: the published form + version + schema needed to render the public fill page.
/** The one payload the fill page needs: workflow state + schema + any saved answers (resume). */
export type SubmitFillBundle = {
  workflowState: string;
  schema: Record<string, unknown> | null;
  // The submission's answer document; null for a just-opened submission (no saved answers yet).
  content: { data?: Record<string, unknown> } | null;
};
