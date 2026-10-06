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

/** Provider code of the shared public user that anonymous callers resolve to. */
export const PUBLIC_PROVIDER_CODE = 'public';

export const DraftSaveStatus = {
  allowed: 'allowed',
  /** allowSubmitterDrafts is off. */
  disabled: 'disabled',
  /** The form's effective audience is public, where no one owns a draft. */
  public: 'public',
} as const;
export type DraftSaveStatusCode = (typeof DraftSaveStatus)[keyof typeof DraftSaveStatus];
