import {
  DraftSaveStatus,
  Permissions,
  SubmissionChangeStatus,
  SubmissionParticipantRole,
  SubmissionWorkflowState,
  SubmitRefusal,
  type SubmissionWorkflowStateCode,
  type SubmitRefusalCode,
} from './codes';
import {
  draftSaveStatusOf,
  formAccessAllows,
  isIdentifiedCaller,
  type AccessCaller,
  type FormAccessFacts,
  type SubmitterFormFacts,
} from './formAccess';

/** A caller's standing on one submission, and the submission's state. */
export interface SubmissionAccessFacts {
  /** The caller's active participant role on the submission; null when they hold none. */
  role: string | null;
  workflowState: string;
}

/** A submit-mode decision: allowed, or refused with its reason. */
export type SubmissionChange =
  | { status: typeof SubmissionChangeStatus.allowed }
  | {
      status: typeof SubmissionChangeStatus.denied | typeof SubmissionChangeStatus.closed;
      code: SubmitRefusalCode;
    };

const ALLOWED: SubmissionChange = { status: SubmissionChangeStatus.allowed };

const denied = (code: SubmitRefusalCode): SubmissionChange => ({
  status: SubmissionChangeStatus.denied,
  code,
});

const closed = (code: SubmitRefusalCode): SubmissionChange => ({
  status: SubmissionChangeStatus.closed,
  code,
});

const isAllowed = (change: SubmissionChange): boolean =>
  change.status === SubmissionChangeStatus.allowed;

/**
 * The states before a submission is submitted: continued rather than viewed, open to file uploads,
 * and deletable by its owner.
 */
export const SUBMISSION_IN_PROGRESS_STATES: readonly SubmissionWorkflowStateCode[] = [
  SubmissionWorkflowState.opened,
  SubmissionWorkflowState.draft,
];

/** Whether the submission is in progress: continued, not viewed. */
export const isSubmissionInProgress = (workflowState: string): boolean =>
  (SUBMISSION_IN_PROGRESS_STATES as readonly string[]).includes(workflowState);

/** Opening a new submission: the form's submit permission, then a published version. */
export const startStatusOf = (form: SubmitterFormFacts, caller: AccessCaller): SubmissionChange => {
  if (!formAccessAllows(form, caller, Permissions.submission_create)) {
    return denied(SubmitRefusal.open_denied);
  }
  if (form.publishedVersionId === null) return closed(SubmitRefusal.not_published);
  return ALLOWED;
};

/** Whether opening a new submission is allowed. */
export const canStartSubmission = (form: SubmitterFormFacts, caller: AccessCaller): boolean =>
  isAllowed(startStatusOf(form, caller));

/** Whether a new submission on the form could save a draft. */
export const canSaveSubmissionDraft = (form: SubmitterFormFacts, caller: AccessCaller): boolean =>
  canStartSubmission(form, caller) && draftSaveStatusOf(form) === DraftSaveStatus.allowed;

/** Any active grant reads it. The public user holds the grant on every anonymous submission. */
export const canReadSubmission = (submission: SubmissionAccessFacts): boolean =>
  submission.role !== null;

/**
 * Save or submit: a grant and the form's submit permission. The submission's state and the form's
 * published version do not count.
 */
export const canWriteSubmission = (
  submission: SubmissionAccessFacts,
  form: FormAccessFacts,
  caller: AccessCaller,
): boolean =>
  canReadSubmission(submission) && formAccessAllows(form, caller, Permissions.submission_create);

/** Continued on the fill page rather than viewed: a write, while it is in progress. */
export const canContinueSubmission = (
  submission: SubmissionAccessFacts,
  form: FormAccessFacts,
  caller: AccessCaller,
): boolean =>
  canWriteSubmission(submission, form, caller) && isSubmissionInProgress(submission.workflowState);

/** A draft save: a write, then the form's drafts setting. */
export const saveDraftStatusOf = (
  submission: SubmissionAccessFacts,
  form: SubmitterFormFacts,
  caller: AccessCaller,
): SubmissionChange => {
  if (!canWriteSubmission(submission, form, caller)) return denied(SubmitRefusal.write_denied);
  const drafts = draftSaveStatusOf(form);
  if (drafts === DraftSaveStatus.disabled) return denied(SubmitRefusal.drafts_disabled);
  if (drafts === DraftSaveStatus.public) return denied(SubmitRefusal.drafts_public);
  return ALLOWED;
};

export const canSaveDraftOnSubmission = (
  submission: SubmissionAccessFacts,
  form: SubmitterFormFacts,
  caller: AccessCaller,
): boolean => isAllowed(saveDraftStatusOf(submission, form, caller));

/** A file upload: a write, then the submission still in progress. */
export const uploadStatusOf = (
  submission: SubmissionAccessFacts,
  form: FormAccessFacts,
  caller: AccessCaller,
): SubmissionChange => {
  if (!canWriteSubmission(submission, form, caller)) return denied(SubmitRefusal.write_denied);
  if (!isSubmissionInProgress(submission.workflowState)) {
    return closed(SubmitRefusal.upload_closed);
  }
  return ALLOWED;
};

export const canUploadSubmissionFile = (
  submission: SubmissionAccessFacts,
  form: FormAccessFacts,
  caller: AccessCaller,
): boolean => isAllowed(uploadStatusOf(submission, form, caller));

/** A file delete: a write while in progress; once submitted, only the form's update permission. */
export const canDeleteSubmissionFile = (
  submission: SubmissionAccessFacts,
  form: FormAccessFacts,
  caller: AccessCaller,
): boolean =>
  submission.workflowState === SubmissionWorkflowState.submitted
    ? formAccessAllows(form, caller, Permissions.submission_update)
    : canWriteSubmission(submission, form, caller);

/** A document render: a grant and the form's template read permission. */
export const canRenderSubmission = (
  submission: SubmissionAccessFacts,
  form: FormAccessFacts,
  caller: AccessCaller,
): boolean =>
  canReadSubmission(submission) &&
  formAccessAllows(form, caller, Permissions.document_template_read);

/** The caller deleting their own submission: the signed-in owner, then still in progress. */
export const ownDeleteStatusOf = (
  submission: SubmissionAccessFacts,
  caller: AccessCaller,
): SubmissionChange => {
  if (!isIdentifiedCaller(caller) || submission.role !== SubmissionParticipantRole.owner) {
    return denied(SubmitRefusal.delete_denied);
  }
  if (!isSubmissionInProgress(submission.workflowState)) {
    return closed(SubmitRefusal.delete_closed);
  }
  return ALLOWED;
};

export const canDeleteOwnSubmission = (
  submission: SubmissionAccessFacts,
  caller: AccessCaller,
): boolean => isAllowed(ownDeleteStatusOf(submission, caller));
