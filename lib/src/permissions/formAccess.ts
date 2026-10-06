import type { AudienceMode } from '../schemas/formSettings/audience';
import {
  DraftSaveStatus,
  Permissions,
  PUBLIC_PROVIDER_CODE,
  type DraftSaveStatusCode,
  type PermissionCode,
} from './codes';

// What a form's audience conveys to people outside the workspace; anything else stays staff-only.
const AUDIENCE_PERMISSIONS: ReadonlySet<string> = new Set<PermissionCode>([
  Permissions.form_read,
  Permissions.submission_create,
  Permissions.submission_read,
  Permissions.document_template_read,
]);

/** Whether a form's audience can convey `code` to someone outside the workspace. */
export const isAudiencePermission = (code: string): boolean => AUDIENCE_PERMISSIONS.has(code);

/** Who is asking: the provider the session signed in through, `public` for an anonymous caller. */
export interface AccessCaller {
  idpCode?: string | null;
}

/** What a form's access rules read for one caller. */
export interface FormAccessFacts {
  /** The caller's permission codes on the form, from the groups they are an effective member of. */
  permissions: readonly string[];
  /** The form's own audience, or its workspace's when it inherits; null when it has none. */
  audienceMode: AudienceMode | null;
  /** Login providers a protected audience admits. */
  audienceIdps: readonly string[];
}

/** What the drafts rule reads. */
export interface DraftSaveFacts {
  /** The form's own drafts setting, or its workspace's when it inherits. */
  allowSubmitterDrafts: boolean;
  audienceMode: AudienceMode | null;
}

/** Everything the submitter rules read about one form. */
export interface SubmitterFormFacts extends FormAccessFacts, DraftSaveFacts {
  /** Null when the form has no published version. */
  publishedVersionId: string | null;
}

const isCodeList = (codes: readonly string[] | ReadonlySet<string>): codes is readonly string[] =>
  Array.isArray(codes);

/** True when `granted` satisfies every code in `required`, honoring the `*` wildcard. */
export const hasAllPermissions = (
  granted: readonly string[] | ReadonlySet<string>,
  required: readonly string[],
): boolean => {
  const codes = isCodeList(granted) ? new Set(granted) : granted;
  return codes.has(Permissions.all) || required.every((code) => codes.has(code));
};

/**
 * A signed-in caller. The shared public user owns every anonymous submission, so its ownership
 * grants nothing and it has no submissions of its own.
 */
export const isIdentifiedCaller = (caller: AccessCaller): boolean =>
  !!caller.idpCode && caller.idpCode !== PUBLIC_PROVIDER_CODE;

/**
 * Public admits everyone, including anonymous callers; protected admits callers signed in through
 * one of its providers; members admits no one.
 */
export const audienceAdmits = (
  facts: Pick<FormAccessFacts, 'audienceMode' | 'audienceIdps'>,
  caller: AccessCaller,
): boolean =>
  facts.audienceMode === 'public' ||
  (facts.audienceMode === 'protected' &&
    !!caller.idpCode &&
    facts.audienceIdps.includes(caller.idpCode));

/**
 * Whether the caller may do `required` on the form: by the roles of the groups they are an
 * effective member of, or, for an audience permission, because the form's audience admits them.
 * The public user's roles never count.
 */
export const formAccessAllows = (
  facts: FormAccessFacts,
  caller: AccessCaller,
  required: PermissionCode,
): boolean =>
  (caller.idpCode !== PUBLIC_PROVIDER_CODE && hasAllPermissions(facts.permissions, [required])) ||
  (isAudiencePermission(required) && audienceAdmits(facts, caller));

/** Whether the form accepts draft saves, or which check refuses them. */
export const draftSaveStatusOf = (facts: DraftSaveFacts): DraftSaveStatusCode => {
  if (!facts.allowSubmitterDrafts) return DraftSaveStatus.disabled;
  if (facts.audienceMode === 'public') return DraftSaveStatus.public;
  return DraftSaveStatus.allowed;
};

/** Whether opening a new submission is allowed: a published version and the open permission. */
export const canStartSubmission = (form: SubmitterFormFacts, caller: AccessCaller): boolean =>
  form.publishedVersionId !== null && formAccessAllows(form, caller, Permissions.submission_create);

/** Whether a new submission on the form could save a draft. */
export const canSaveSubmissionDraft = (form: SubmitterFormFacts, caller: AccessCaller): boolean =>
  canStartSubmission(form, caller) && draftSaveStatusOf(form) === DraftSaveStatus.allowed;
