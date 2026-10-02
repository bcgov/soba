import { isPublicSubmitterAudience } from '../../../core/db/repos/formSubmitAccessRepo';
import type { FormSettingsContext } from '../routes';
import { submitterSettingsService } from './service';

export const DraftSaveStatus = {
  allowed: 'allowed',
  /** allowSubmitterDrafts is off. */
  disabled: 'disabled',
  /** The form's effective audience is public. */
  public: 'public',
} as const;
export type DraftSaveStatusCode = (typeof DraftSaveStatus)[keyof typeof DraftSaveStatus];

/** Whether the form accepts draft saves, or which check refuses them. */
export const getDraftSaveStatus = async (
  ctx: FormSettingsContext,
  formId: string,
): Promise<DraftSaveStatusCode> => {
  const { allowSubmitterDrafts } = await submitterSettingsService.get(ctx, formId);
  if (!allowSubmitterDrafts) return DraftSaveStatus.disabled;
  const isPublic = await isPublicSubmitterAudience({ workspaceId: ctx.workspaceId, formId });
  return isPublic ? DraftSaveStatus.public : DraftSaveStatus.allowed;
};
