export const Permissions = {
  all: '*',
  form_create: 'form_create',
  form_read: 'form_read',
  form_update: 'form_update',
  form_delete: 'form_delete',
  design_create: 'design_create',
  design_read: 'design_read',
  design_update: 'design_update',
  design_delete: 'design_delete',
  submission_create: 'submission_create',
  submission_read: 'submission_read',
  submission_update: 'submission_update',
  submission_delete: 'submission_delete',
  submission_review: 'submission_review',
  team_read: 'team_read',
  team_update: 'team_update',
  document_template_create: 'document_template_create',
  document_template_read: 'document_template_read',
  document_template_delete: 'document_template_delete',
} as const;

export type PermissionCode = (typeof Permissions)[keyof typeof Permissions];

/**
 * POST /forms writes the form and its first design. `form_create` is not seeded onto any role;
 * only form_admin matches it (via `*`). form_designer has `design_create` for new designs on
 * existing forms.
 */
export const FormCreatePermissions = [Permissions.form_create, Permissions.design_create] as const;

/** Provider code of the shared public user that anonymous callers resolve to. */
export const PUBLIC_PROVIDER_CODE = 'public';

/** Submission lifecycle state (submission.workflow_state). Backend-owned; clients never set it. */
export const SubmissionWorkflowState = {
  opened: 'opened',
  draft: 'draft',
  submitted: 'submitted',
  deleted: 'deleted',
} as const;
export type SubmissionWorkflowStateCode =
  (typeof SubmissionWorkflowState)[keyof typeof SubmissionWorkflowState];

/**
 * A user's standing on one submission (submission_participant.role). Owners and collaborators have
 * the same access, except that only an owner deletes the submission.
 */
export const SubmissionParticipantRole = {
  owner: 'owner',
  collaborator: 'collaborator',
} as const;
export type SubmissionParticipantRoleCode =
  (typeof SubmissionParticipantRole)[keyof typeof SubmissionParticipantRole];

export const DraftSaveStatus = {
  allowed: 'allowed',
  /** allowSubmitterDrafts is off. */
  disabled: 'disabled',
  /** The form's effective audience is public, where no one owns a draft. */
  public: 'public',
} as const;
export type DraftSaveStatusCode = (typeof DraftSaveStatus)[keyof typeof DraftSaveStatus];

/** Whether a change goes ahead, is refused for this caller, or is refused for the target's state. */
export const SubmissionChangeStatus = {
  allowed: 'allowed',
  denied: 'denied',
  closed: 'closed',
} as const;
export type SubmissionChangeStatusCode =
  (typeof SubmissionChangeStatus)[keyof typeof SubmissionChangeStatus];

/**
 * Why a submit-mode request was refused. A `*_denied` refusal is 401 for an anonymous caller and 403
 * otherwise; `drafts_*` is 403; `*_closed` is 409; `not_published` is 404.
 */
export const SubmitRefusal = {
  open_denied: 'open_denied',
  read_denied: 'read_denied',
  write_denied: 'write_denied',
  render_denied: 'render_denied',
  delete_denied: 'delete_denied',
  drafts_disabled: 'drafts_disabled',
  drafts_public: 'drafts_public',
  upload_closed: 'upload_closed',
  delete_closed: 'delete_closed',
  not_published: 'not_published',
} as const;
export type SubmitRefusalCode = (typeof SubmitRefusal)[keyof typeof SubmitRefusal];
