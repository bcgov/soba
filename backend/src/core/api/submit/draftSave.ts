import type { NextFunction, Request, Response } from 'express';
import {
  DraftSaveStatus,
  getDraftSaveStatus,
  type DraftSaveStatusCode,
} from '../../../features/form-settings/submitter';
import { ForbiddenError } from '../../errors';
import { log } from '../../logging';

const REFUSAL_MESSAGES: Record<Exclude<DraftSaveStatusCode, 'allowed'>, string> = {
  disabled: 'Drafts are not enabled for this form',
  public: 'Drafts are not available on a public form',
};

/** Refuses a save when the form does not accept drafts. Runs after requireFormSubmitAccess. */
export const requireDraftSave = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ctx = req.coreContext;
    if (!ctx?.formId) {
      throw new Error('requireDraftSave must run after submit target resolution');
    }
    const status = await getDraftSaveStatus(ctx, ctx.formId);
    if (status !== DraftSaveStatus.allowed) {
      log.warn(
        { formId: ctx.formId, submissionId: req.params.id, actorId: req.actorId, reason: status },
        'Draft save refused',
      );
      throw new ForbiddenError(REFUSAL_MESSAGES[status]);
    }
    next();
  } catch (error) {
    next(error);
  }
};
