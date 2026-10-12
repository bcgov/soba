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
 * Why a submit-mode, file or document request failed. A `*_denied` refusal is 401 for an anonymous
 * caller and 403 otherwise; `drafts_*` is 403; `*_closed`, `*_taken` and `version_not_published` are
 * 409; `*_not_found` and `not_published` are 404; `*_invalid` and `form_not_ready` are 400;
 * `*_unavailable` and `render_busy` are 503; `render_failed`, `no_saved_data` and `file_infected`
 * are 422; `file_type_blocked` is 415; `file_too_large` is 413.
 */
export const SubmitError = {
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
  // Opening a submission.
  form_not_found: 'form_not_found',
  submission_id_taken: 'submission_id_taken',
  version_not_published: 'version_not_published',
  // An existing submission and its writes.
  submission_not_found: 'submission_not_found',
  schema_not_found: 'schema_not_found',
  content_not_found: 'content_not_found',
  revision_id_taken: 'revision_id_taken',
  revision_base_invalid: 'revision_base_invalid',
  form_not_ready: 'form_not_ready',
  // Files.
  file_not_found: 'file_not_found',
  file_unavailable: 'file_unavailable',
  file_type_blocked: 'file_type_blocked',
  file_too_large: 'file_too_large',
  upload_invalid: 'upload_invalid',
  file_infected: 'file_infected',
  scan_unavailable: 'scan_unavailable',
  // Documents.
  template_not_found: 'template_not_found',
  template_unavailable: 'template_unavailable',
  render_unavailable: 'render_unavailable',
  render_busy: 'render_busy',
  render_failed: 'render_failed',
  no_saved_data: 'no_saved_data',
} as const;
export type SubmitErrorCode = (typeof SubmitError)[keyof typeof SubmitError];
