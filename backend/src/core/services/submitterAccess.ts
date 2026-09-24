import { Permissions, type PermissionCode } from '../db/codes';
import {
  hasFormSubmitAccess,
  type CallerIdentity,
  type FormAccessTarget,
} from '../db/repos/formSubmitAccessRepo';
import { isActiveParticipant } from '../db/repos/submissionParticipantRepo';

/** What a caller does through submit mode. Design-mode routes do not use this policy. */
export const SubmitterOperation = {
  /** Open a new submission on a form. */
  open: 'open',
  /** Read an existing submission: confirmation, data, schema, fill bundle, files, print, preview. */
  read: 'read',
  /** Save, submit, file upload, and delete of a file on an un-submitted submission. */
  write: 'write',
  /** Delete a file on an already-submitted submission. */
  deleteSubmittedFile: 'deleteSubmittedFile',
} as const;
export type SubmitterOperationCode = (typeof SubmitterOperation)[keyof typeof SubmitterOperation];

/** The form an operation is on and, once one exists, the submission. */
export interface SubmitterAccessTarget extends FormAccessTarget {
  submissionId?: string;
}

type AccessCheck = (target: SubmitterAccessTarget, caller: CallerIdentity) => Promise<boolean>;

const isParticipant: AccessCheck = async (target, caller) =>
  !!target.submissionId &&
  !!caller.actorId &&
  isActiveParticipant(target.submissionId, caller.actorId);

const hasFormPermission =
  (permission: PermissionCode): AccessCheck =>
  (target, caller) =>
    hasFormSubmitAccess(target, caller, permission);

// Every check in a rule must pass. They run in order and stop at the first refusal, so the index
// lookup for participation runs before the heavier form permission resolution.
const RULES: Record<SubmitterOperationCode, readonly AccessCheck[]> = {
  open: [hasFormPermission(Permissions.submission_create)],
  read: [isParticipant],
  write: [isParticipant, hasFormPermission(Permissions.submission_create)],
  deleteSubmittedFile: [hasFormPermission(Permissions.submission_update)],
};

/** Whether the caller may perform a submit-mode operation on the target. */
export const isSubmitterAllowed = async (
  operation: SubmitterOperationCode,
  target: SubmitterAccessTarget,
  caller: CallerIdentity,
): Promise<boolean> => {
  for (const check of RULES[operation]) {
    if (!(await check(target, caller))) return false;
  }
  return true;
};
