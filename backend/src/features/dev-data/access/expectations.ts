/**
 * Who each check admits in the coverage set. A persona left out of a list is refused. Owner cells
 * assume the owner signs in through OWNER_PROVIDER.
 */
import {
  PERSONA_KEYS,
  type CoverageFormKey,
  type CoverageSubmissionKey,
  type PersonaKey,
} from './plan';

export interface FormExpectation {
  /** In My Forms, and its workspace in the My Forms filter. */
  listed: PersonaKey[];
  /** Opens a new submission: a live form, a published version, and the open rule. */
  start: PersonaKey[];
  /** Saves a draft of a new submission: start, and the form accepts drafts. */
  draft: PersonaKey[];
  /** document_template_read, as the access check answers it. */
  templates: PersonaKey[];
  /** submission_update, as the access check answers it. */
  update: PersonaKey[];
}

export interface SubmissionExpectation {
  /** In My Submissions. */
  mine: PersonaKey[];
  read: PersonaKey[];
  /** The write rule save and submit share. The request can still refuse or hold the write. */
  write: PersonaKey[];
  /** Deletes it: an owner grant, signed in, before it is submitted. */
  delete: PersonaKey[];
}

export const FORM_CHECKS = ['listed', 'start', 'draft', 'templates', 'update'] as const;
export const SUBMISSION_CHECKS = ['mine', 'read', 'write', 'delete'] as const;

export type FormCheck = (typeof FORM_CHECKS)[number];
export type SubmissionCheck = (typeof SUBMISSION_CHECKS)[number];

/** One persona's answers on one case. */
export interface CaseResult<TCase extends string, TCheck extends string> {
  persona: PersonaKey;
  caseKey: TCase;
  actual: Record<TCheck, boolean>;
  expected: Record<TCheck, boolean>;
}

/** Whether the table admits the persona, per check. */
export const expectedOf = <TCheck extends string>(
  checks: readonly TCheck[],
  table: Record<TCheck, readonly PersonaKey[]>,
  persona: PersonaKey,
): Record<TCheck, boolean> =>
  Object.fromEntries(checks.map((check) => [check, table[check].includes(persona)])) as Record<
    TCheck,
    boolean
  >;

/** Cells whose answer differs from the table. */
export const mismatchesOf = <TCase extends string, TCheck extends string>(
  results: CaseResult<TCase, TCheck>[],
): Array<{ persona: PersonaKey; caseKey: TCase; check: TCheck; expected: boolean }> =>
  results.flatMap((result) =>
    (Object.keys(result.expected) as TCheck[])
      .filter((check) => result.expected[check] !== result.actual[check])
      .map((check) => ({
        persona: result.persona,
        caseKey: result.caseKey,
        check,
        expected: result.expected[check],
      })),
  );

const EVERYONE: PersonaKey[] = [...PERSONA_KEYS];

/** Everyone signing in through IDIR. */
const IDIR: PersonaKey[] = EVERYONE.filter((p) => p !== 'bceidOutsider' && p !== 'anonymous');

/** Effective form_submitter role holders in the roles workspace, without an override. */
const ROLE_SUBMITTERS: PersonaKey[] = ['owner', 'submitter', 'overrideRemoved'];

const ROLES_STAFF_UPDATE: PersonaKey[] = ['admin', 'reviewer'];

const rolesInherited = (): FormExpectation => ({
  listed: ROLE_SUBMITTERS,
  start: ['admin', ...ROLE_SUBMITTERS],
  draft: ['admin', ...ROLE_SUBMITTERS],
  templates: ['admin', ...ROLE_SUBMITTERS],
  update: ROLES_STAFF_UPDATE,
});

/** The access check reads roles, not whether the form or its version still exists. */
const rolesUnlisted = (): FormExpectation => ({
  listed: [],
  start: [],
  draft: [],
  templates: ['admin', ...ROLE_SUBMITTERS],
  update: ROLES_STAFF_UPDATE,
});

export const FORM_EXPECTATIONS: Record<CoverageFormKey, FormExpectation> = {
  rolesInherit: rolesInherited(),
  rolesOverride: {
    listed: ['submitter', 'overrideAdded'],
    start: ['admin', 'submitter', 'overrideAdded'],
    draft: ['admin', 'submitter', 'overrideAdded'],
    templates: ['admin', 'submitter', 'overrideAdded'],
    update: ROLES_STAFF_UPDATE,
  },
  rolesOverrideCleared: rolesInherited(),
  rolesUnpublished: rolesUnlisted(),
  rolesFormDeleted: rolesUnlisted(),
  rolesVersionDeleted: rolesUnlisted(),
  rolesDraftsOff: {
    listed: ROLE_SUBMITTERS,
    start: ['admin', ...ROLE_SUBMITTERS],
    draft: [],
    templates: ['admin', ...ROLE_SUBMITTERS],
    update: ROLES_STAFF_UPDATE,
  },
  protectedInherit: {
    listed: ['outsider'],
    start: IDIR,
    draft: [],
    templates: IDIR,
    update: ['admin', 'owner'],
  },
  publicOwn: {
    listed: [],
    start: EVERYONE,
    draft: [],
    templates: EVERYONE,
    update: ['admin', 'owner'],
  },
  bceidOwn: {
    listed: [],
    start: ['admin', 'owner', 'bceidOutsider'],
    draft: ['admin', 'owner', 'bceidOutsider'],
    templates: ['admin', 'owner', 'bceidOutsider'],
    update: ['admin', 'owner'],
  },
  membersOwn: {
    listed: [],
    start: ['admin', 'owner'],
    draft: ['admin', 'owner'],
    templates: ['admin', 'owner'],
    update: ['admin', 'owner'],
  },
  publicInherit: {
    listed: [],
    start: EVERYONE,
    draft: [],
    templates: EVERYONE,
    update: ['admin'],
  },
  protectedOwn: {
    listed: ['outsider', 'collaborator', 'bceidOutsider', 'owner'],
    start: IDIR,
    draft: IDIR,
    templates: IDIR,
    update: ['admin'],
  },
};

const NONE: SubmissionExpectation = { mine: [], read: [], write: [], delete: [] };

export const SUBMISSION_EXPECTATIONS: Record<CoverageSubmissionKey, SubmissionExpectation> = {
  outsiderDraft: {
    mine: ['outsider', 'collaborator', 'bceidOutsider'],
    read: ['outsider', 'collaborator', 'bceidOutsider'],
    write: ['outsider', 'collaborator'],
    delete: ['outsider'],
  },
  outsiderSubmitted: { mine: ['outsider'], read: ['outsider'], write: ['outsider'], delete: [] },
  outsiderOpened: { mine: [], read: ['outsider'], write: ['outsider'], delete: ['outsider'] },
  bceidDeleted: NONE,
  submitterOnDeletedVersion: {
    mine: [],
    read: ['submitter'],
    write: ['submitter'],
    delete: [],
  },
  submitterOnDeletedForm: {
    mine: [],
    read: ['submitter'],
    write: ['submitter'],
    delete: ['submitter'],
  },
  ownerDraft: { mine: ['owner'], read: ['owner'], write: ['owner'], delete: ['owner'] },
  // The public user owns every anonymous submission, so any anonymous caller holding the id passes.
  anonymousSubmitted: { mine: [], read: ['anonymous'], write: ['anonymous'], delete: [] },
  anonymousOpened: { mine: [], read: ['anonymous'], write: ['anonymous'], delete: [] },
};
