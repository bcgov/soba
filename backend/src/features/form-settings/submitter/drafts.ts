import { draftSaveStatusOf, DraftSaveStatus, type DraftSaveStatusCode } from '@soba/lib';
import { findSubmitterFormFacts } from '../../../core/db/repos/submitterFormRepo';
import { NotFoundError } from '../../../core/errors';
import { log } from '../../../core/logging';
import type { FormSettingsContext } from '../routes';

const FORM_NOT_FOUND = 'Form not found';

/** Whether the form accepts draft saves, or which check refuses them. */
export const getDraftSaveStatus = async (
  ctx: FormSettingsContext,
  formId: string,
): Promise<DraftSaveStatusCode> => {
  const facts = await findSubmitterFormFacts({
    userId: null,
    workspaceId: ctx.workspaceId,
    formId,
  });
  if (!facts) throw new NotFoundError(FORM_NOT_FOUND);
  return draftSaveStatusOf(facts);
};

/** Whether a submission on the form could save a draft; a failed lookup offers none. */
export const offersDraftSave = async (
  ctx: FormSettingsContext,
  formId: string,
): Promise<boolean> => {
  try {
    return (await getDraftSaveStatus(ctx, formId)) === DraftSaveStatus.allowed;
  } catch (err) {
    log.error({ err, formId }, 'Draft save status lookup failed');
    return false;
  }
};
