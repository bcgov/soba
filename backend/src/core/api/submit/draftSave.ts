import type { NextFunction, Request, Response } from 'express';
import { draftSaveStatusOf, DraftSaveStatus, type DraftSaveStatusCode } from '@soba/lib';
import { loadedSubmission } from '../../middleware/formSubmitAccess';
import { ForbiddenError } from '../../errors';
import { log } from '../../logging';

const REFUSAL_MESSAGES: Record<Exclude<DraftSaveStatusCode, 'allowed'>, string> = {
  disabled: 'Drafts are not enabled for this form',
  public: 'Drafts are not available on a public form',
};

/** Refuses a save when the form does not accept drafts. Runs after requireSubmissionWrite. */
export const requireDraftSave = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const { submission, form } = loadedSubmission(req);
    const status = draftSaveStatusOf(form);
    if (status !== DraftSaveStatus.allowed) {
      log.warn(
        {
          formId: submission.formId,
          submissionId: submission.id,
          actorId: req.actorId,
          reason: status,
        },
        'Draft save refused',
      );
      throw new ForbiddenError(REFUSAL_MESSAGES[status]);
    }
    next();
  } catch (error) {
    next(error);
  }
};
