import {
  canReadSubmission,
  canRenderSubmission,
  canWriteSubmission,
  formAccessAllows,
  ownDeleteStatusOf,
  SubmissionChangeStatus,
} from '@soba/lib';
import { Permissions } from '../db/codes';
import {
  hasFormSubmitAccess,
  type CallerIdentity,
  type FormAccessTarget,
} from '../db/repos/formSubmitAccessRepo';
import {
  findSubmitterSubmission,
  type SubmitterSubmission,
} from '../db/repos/submitterSubmissionRepo';

/** What a caller does through submit mode. Design-mode routes do not use this policy. */
export const SubmitterOperation = {
  /** Open a new submission on a form. */
  open: 'open',
  /** Read an existing submission: confirmation, data, schema, fill bundle, files. */
  read: 'read',
  /** Save, submit, file upload, and delete of a file on an un-submitted submission. */
  write: 'write',
  /** Delete a file on an already-submitted submission. */
  deleteSubmittedFile: 'deleteSubmittedFile',
  /** Render a document from a submission with a stored template: print, preview, template list. */
  render: 'render',
  /** Delete the caller's own submission; the lifecycle limits it to one not yet submitted. */
  delete: 'delete',
} as const;
export type SubmitterOperationCode = (typeof SubmitterOperation)[keyof typeof SubmitterOperation];

/** The form an operation is on and, once one exists, the submission. */
export interface SubmitterAccessTarget extends FormAccessTarget {
  submissionId?: string;
}

type SubmissionOperation = Exclude<SubmitterOperationCode, 'open'>;

const SUBMISSION_RULES: Record<
  SubmissionOperation,
  (loaded: SubmitterSubmission, caller: CallerIdentity) => boolean
> = {
  read: ({ access }) => canReadSubmission(access),
  write: ({ access, form }, caller) => canWriteSubmission(access, form, caller),
  deleteSubmittedFile: ({ form }, caller) =>
    formAccessAllows(form, caller, Permissions.submission_update),
  render: ({ access, form }, caller) => canRenderSubmission(access, form, caller),
  // The signed-in owner, whatever the state; the delete itself refuses a submitted submission.
  delete: ({ access }, caller) =>
    ownDeleteStatusOf(access, caller).status !== SubmissionChangeStatus.denied,
};

/**
 * Whether the caller may perform a submit-mode operation on the target. An operation on a submission
 * applies the @soba/lib rules over the read the submit routes use, and needs it, its form and its
 * version live. Open checks the form's submit permission only, not its published version.
 */
export const isSubmitterAllowed = async (
  operation: SubmitterOperationCode,
  target: SubmitterAccessTarget,
  caller: CallerIdentity,
): Promise<boolean> => {
  if (operation === SubmitterOperation.open) {
    return hasFormSubmitAccess(target, caller, Permissions.submission_create);
  }
  if (!target.submissionId || !caller.actorId) return false;
  const loaded = await findSubmitterSubmission({
    submissionId: target.submissionId,
    actorId: caller.actorId,
    idpCode: caller.idpCode,
  });
  return !!loaded && SUBMISSION_RULES[operation](loaded, caller);
};
