/**
 * Runs every coverage case through the code the submit, design and workspace routes use, and
 * compares the answers with the expectations table. Reads only.
 */
import { and, eq } from 'drizzle-orm';
import {
  audienceAdmits,
  canSaveSubmissionDraft,
  canStartSubmission,
  DEFAULT_SORT_LOCALE,
  DraftSaveStatus,
  draftSaveStatusOf,
  hasAllPermissions,
  isIdentifiedCaller,
  Permissions,
  PUBLIC_PROVIDER_CODE,
  type PermissionCode,
} from '@soba/lib';

import { db } from '../../../core/db/client';
import { submissionParticipants } from '../../../core/db/schema';
import {
  resolveFormAccessGrant,
  resolveFormPermissions,
  type FormAccessGrant,
} from '../../../core/db/repos/formAccessRepo';
import { getWorkspaceIdForForm, listFormsForWorkspace } from '../../../core/db/repos/formRepo';
import {
  findActorMembership,
  getActiveWorkspaceIdsForUser,
  isWorkspacePeopleReadRole,
} from '../../../core/db/repos/membershipRepo';
import {
  hasFormSubmitAccess,
  type CallerIdentity,
} from '../../../core/db/repos/formSubmitAccessRepo';
import {
  getPublishedVersionForForm,
  listFormVersionsForWorkspace,
} from '../../../core/db/repos/formVersionRepo';
import {
  getSubmissionWorkspaceAndState,
  listSubmissionsForParticipant,
  listSubmissionsForWorkspace,
} from '../../../core/db/repos/submissionRepo';
import {
  findSubmitterFormFacts,
  listFormsForSubmitter,
  listWorkspacesForSubmitter,
  type SubmitterFormListRow,
} from '../../../core/db/repos/submitterFormRepo';
import { SUBMITTER_DELETABLE_STATES } from '../../../core/services/submissionLifecycle';
import { isSubmitterAllowed, SubmitterOperation } from '../../../core/services/submitterAccess';
import { ValidationError } from '../../../core/errors';
import { getDraftSaveStatus } from '../../form-settings/submitter/drafts';
import { inSequence } from '../inSequence';
import { findActiveManifest } from '../runs';
import {
  DESIGN_CHECKS,
  DESIGN_EXPECTATIONS,
  expectedOf,
  FORM_CHECKS,
  FORM_EXPECTATIONS,
  SUBMISSION_CHECKS,
  SUBMISSION_EXPECTATIONS,
  WORKSPACE_CHECKS,
  WORKSPACE_EXPECTATIONS,
  type CaseResult,
  type DesignCheck,
  type FormCheck,
  type SubmissionCheck,
  type WorkspaceCheck,
} from './expectations';
import type { CoverageFormRef, CoverageManifest, CoverageSubmissionRef } from './generate';
import {
  COVERAGE_FORM_KEYS,
  COVERAGE_SUBMISSION_KEYS,
  COVERAGE_WORKSPACE_KEYS,
  OWNER,
  OWNER_PROVIDER,
  PERSONA_KEYS,
  type CoverageFormKey,
  type CoverageSubmissionKey,
  type CoverageWorkspaceKey,
  type PersonaKey,
} from './plan';

export interface CoverageReport {
  /** Personas whose cases were checked. */
  personas: PersonaKey[];
  /** Why a persona was left out. */
  skipped: string[];
  forms: CaseResult<CoverageFormKey, FormCheck>[];
  design: CaseResult<CoverageFormKey, DesignCheck>[];
  workspaces: CaseResult<CoverageWorkspaceKey, WorkspaceCheck>[];
  submissions: CaseResult<CoverageSubmissionKey, SubmissionCheck>[];
  /** Disagreements between two code paths that should give the same answer. */
  inconsistencies: string[];
}

/** Results for a group of cases, and where two code paths disagreed on them. */
interface CaseCheck<TCase extends string, TCheck extends string> {
  results: CaseResult<TCase, TCheck>[];
  issues: string[];
}

interface Caller {
  persona: PersonaKey;
  identity: CallerIdentity;
  /** A signed-in caller with lists of their own. */
  signedIn: boolean;
}

const MAX_ROWS = 1000;

const REQUIRES_SEED = 'No dev data with a coverage set here; run pnpm db:dev-data --reset';

const OUT_OF_DATE = 'The coverage set predates this plan; run pnpm db:dev-data --reset';

const hasKeys = (record: object | undefined, keys: readonly string[]): boolean =>
  !!record && keys.every((key) => key in record);

/** The seeded set, refused when it lacks a case the plan now has. */
export async function loadCoverageManifest(): Promise<CoverageManifest> {
  const manifest = (await findActiveManifest()) as { coverage?: Partial<CoverageManifest> } | null;
  const coverage = manifest?.coverage;
  if (!coverage) throw new ValidationError(REQUIRES_SEED);
  const current =
    hasKeys(coverage.personas, PERSONA_KEYS) &&
    hasKeys(coverage.workspaces, COVERAGE_WORKSPACE_KEYS) &&
    hasKeys(coverage.forms, COVERAGE_FORM_KEYS) &&
    hasKeys(coverage.submissions, COVERAGE_SUBMISSION_KEYS);
  if (!current) throw new ValidationError(OUT_OF_DATE);
  return coverage as CoverageManifest;
}

const callerOf = (manifest: CoverageManifest, persona: PersonaKey): Caller => {
  const ref = manifest.personas[persona];
  const identity = { actorId: ref.id, idpCode: ref.identityProviderCode };
  return { persona, identity, signedIn: isIdentifiedCaller(identity) };
};

/** The caller's user id when they are signed in; null for the public user. */
const signedInActorId = (caller: Caller): string | null =>
  caller.signedIn ? (caller.identity.actorId ?? null) : null;

/** My Forms rows in the workspace, by form id. */
async function myFormRows(
  caller: Caller,
  workspaceId: string,
): Promise<Map<string, SubmitterFormListRow>> {
  const actorId = signedInActorId(caller);
  if (!actorId) return new Map();
  const { items } = await listFormsForSubmitter({
    userId: actorId,
    offset: 0,
    limit: MAX_ROWS,
    workspaceId,
    sort: 'name:asc',
    locale: DEFAULT_SORT_LOCALE,
  });
  return new Map(items.map((row) => [row.id, row]));
}

async function myWorkspaceIds(caller: Caller): Promise<Set<string>> {
  const actorId = signedInActorId(caller);
  if (!actorId) return new Set();
  const rows = await listWorkspacesForSubmitter({
    userId: actorId,
    limit: MAX_ROWS,
    locale: DEFAULT_SORT_LOCALE,
  });
  return new Set(rows.map((row) => row.id));
}

async function mySubmissionIds(caller: Caller): Promise<Set<string>> {
  const actorId = signedInActorId(caller);
  if (!actorId) return new Set();
  const { items } = await listSubmissionsForParticipant({
    userId: actorId,
    offset: 0,
    limit: MAX_ROWS,
    sort: 'createdAt:desc',
    locale: DEFAULT_SORT_LOCALE,
  });
  return new Set(items.map((row) => row.id));
}

async function formAnswers(
  caller: Caller,
  form: CoverageFormRef,
): Promise<Omit<Record<FormCheck, boolean>, 'listed'>> {
  const target = { workspaceId: form.workspaceId, formId: form.formId };
  const live = (await getWorkspaceIdForForm(form.formId)) !== null;
  const published =
    live && (await getPublishedVersionForForm(form.workspaceId, form.formId)) !== null;
  const start =
    published && (await isSubmitterAllowed(SubmitterOperation.open, target, caller.identity));
  const draft =
    start &&
    (await getDraftSaveStatus(
      { workspaceId: form.workspaceId, actorDisplayLabel: null },
      form.formId,
    )) === DraftSaveStatus.allowed;
  return {
    start,
    draft,
    templates: await hasFormSubmitAccess(
      target,
      caller.identity,
      Permissions.document_template_read,
    ),
    update: await hasFormSubmitAccess(target, caller.identity, Permissions.submission_update),
  };
}

async function submissionAnswers(
  caller: Caller,
  ref: CoverageSubmissionRef,
  mine: Set<string>,
): Promise<Record<SubmissionCheck, boolean>> {
  const live = await getSubmissionWorkspaceAndState(ref.submissionId);
  const allows = async (operation: keyof typeof SubmitterOperation) =>
    !!live && isSubmitterAllowed(SubmitterOperation[operation], ref, caller.identity);
  const deletable =
    !!live &&
    (SUBMITTER_DELETABLE_STATES as readonly string[]).includes(live.workflowState) &&
    (await allows('delete'));
  return {
    mine: mine.has(ref.submissionId),
    read: await allows('read'),
    write: await allows('write'),
    delete: deletable,
  };
}

/** The My Forms row's own Start and Save draft must match what the routes allow. */
function rowInconsistencies(
  caller: Caller,
  formKey: CoverageFormKey,
  row: SubmitterFormListRow,
  answers: { start: boolean; draft: boolean },
): string[] {
  const issues: string[] = [];
  const idp = { idpCode: caller.identity.idpCode };
  if (canStartSubmission(row, idp) !== answers.start) {
    issues.push(`${caller.persona} x ${formKey}: My Forms row start differs from the open route`);
  }
  if (canSaveSubmissionDraft(row, idp) !== answers.draft) {
    issues.push(`${caller.persona} x ${formKey}: My Forms row draft differs from the drafts rule`);
  }
  return issues;
}

/** Answers for one persona and one form, read alongside the My Forms rows of its workspace. */
async function checkForm(
  manifest: CoverageManifest,
  caller: Caller,
  formKey: CoverageFormKey,
  rows: Map<string, SubmitterFormListRow>,
): Promise<{ result: CaseResult<CoverageFormKey, FormCheck>; issues: string[] }> {
  const form = manifest.forms[formKey];
  const row = rows.get(form.formId);
  const answers = await formAnswers(caller, form);
  return {
    result: {
      persona: caller.persona,
      caseKey: formKey,
      actual: { listed: !!row, ...answers },
      expected: expectedOf(FORM_CHECKS, FORM_EXPECTATIONS[formKey], caller.persona),
    },
    issues: row ? rowInconsistencies(caller, formKey, row, answers) : [],
  };
}

/** The keys of the coverage forms in `workspaceId`. */
const formKeysIn = (manifest: CoverageManifest, workspaceId: string): CoverageFormKey[] =>
  COVERAGE_FORM_KEYS.filter((key) => manifest.forms[key].workspaceId === workspaceId);

const formKeyOf = (manifest: CoverageManifest, formId: string): string =>
  COVERAGE_FORM_KEYS.find((key) => manifest.forms[key].formId === formId) ?? formId;

/** A design list's rows in `workspaceIds` under `formAccess`, as the form id of each. */
type DesignListFormIds = (workspaceIds: string[], formAccess: FormAccessGrant) => Promise<string[]>;

const designFormsList: DesignListFormIds = async (workspaceIds, formAccess) => {
  const { items } = await listFormsForWorkspace({
    workspaceIds,
    formAccess,
    offset: 0,
    limit: MAX_ROWS,
    sort: 'name:asc',
    locale: DEFAULT_SORT_LOCALE,
  });
  return items.map((item) => item.id);
};

/** The design lists, each with the code sets it is run under. */
const DESIGN_LISTS: readonly {
  name: string;
  formIds: DesignListFormIds;
  codeSets: readonly (readonly PermissionCode[])[];
}[] = [
  {
    name: 'forms',
    formIds: designFormsList,
    codeSets: [
      [Permissions.form_read],
      [Permissions.submission_read],
      [Permissions.design_update],
      [Permissions.form_read, Permissions.document_template_read],
    ],
  },
  {
    name: 'form versions',
    formIds: async (workspaceIds, formAccess) => {
      const { items } = await listFormVersionsForWorkspace({
        workspaceIds,
        formAccess,
        offset: 0,
        limit: MAX_ROWS,
        sort: 'versionNo:desc',
      });
      return items.map((item) => item.formId);
    },
    codeSets: [[Permissions.form_read]],
  },
  {
    name: 'submissions',
    formIds: async (workspaceIds, formAccess) => {
      const { items } = await listSubmissionsForWorkspace({
        workspaceIds,
        formAccess,
        offset: 0,
        limit: MAX_ROWS,
        sort: 'updatedAt:desc',
        locale: DEFAULT_SORT_LOCALE,
      });
      return items.map((item) => item.formId);
    },
    codeSets: [[Permissions.submission_read]],
  },
];

/**
 * A grant that passes the workspace's coverage forms by id alone, so a list read with it shares no
 * filter path with an actor's workspace-wide grant.
 */
const coverageFormsGrant = (manifest: CoverageManifest, workspaceId: string): FormAccessGrant => ({
  workspaceIds: [],
  overriddenFormIds: [],
  includedFormIds: formKeysIn(manifest, workspaceId).map((key) => manifest.forms[key].formId),
});

/** Ids in exactly one of `a` and `b`. */
const differing = (a: ReadonlySet<string>, b: ReadonlySet<string>): string[] =>
  [...new Set([...a, ...b])].filter((id) => a.has(id) !== b.has(id));

/**
 * Under the actor's grant, each design list must hold exactly the forms, of those it lists under
 * coverageFormsGrant, whose own check grants the codes.
 */
async function designListInconsistencies(
  manifest: CoverageManifest,
  persona: PersonaKey,
  actorId: string,
  workspaceKey: CoverageWorkspaceKey,
  permissions: ReadonlyMap<string, ReadonlySet<string>>,
): Promise<string[]> {
  const workspaceIds = [manifest.workspaces[workspaceKey].id];
  const fullLists = await Promise.all(
    DESIGN_LISTS.map((list) =>
      list.formIds(workspaceIds, coverageFormsGrant(manifest, workspaceIds[0])),
    ),
  );
  const cases = DESIGN_LISTS.flatMap((list, index) =>
    list.codeSets.map((required) => ({ list, required, full: fullLists[index] })),
  );
  const issues = await Promise.all(
    cases.map(async ({ list, required, full }) => {
      const grant = await resolveFormAccessGrant(actorId, required, workspaceIds);
      const listed = new Set(await list.formIds(workspaceIds, grant));
      const expected = new Set(
        full.filter((formId) => hasAllPermissions(permissions.get(formId) ?? [], required)),
      );
      return differing(listed, expected).map(
        (formId) =>
          `${persona} x ${formKeyOf(manifest, formId)}: ${list.name} list for ${required.join('+')} differs from the form check`,
      );
    }),
  );
  return issues.flat();
}

async function checkWorkspaceForms(
  manifest: CoverageManifest,
  caller: Caller,
  workspaceKey: CoverageWorkspaceKey,
  filter: Set<string>,
): Promise<CaseCheck<CoverageFormKey, FormCheck>> {
  const workspaceId = manifest.workspaces[workspaceKey].id;
  const rows = await myFormRows(caller, workspaceId);
  const checked = await Promise.all(
    formKeysIn(manifest, workspaceId).map((formKey) => checkForm(manifest, caller, formKey, rows)),
  );
  const listedHere = rows.size > 0;
  const filterIssue =
    listedHere === filter.has(workspaceId)
      ? []
      : [`${caller.persona} x ${workspaceKey}: My Forms filter disagrees with the listed forms`];
  return {
    results: checked.map((c) => c.result),
    issues: [...checked.flatMap((c) => c.issues), ...filterIssue],
  };
}

async function checkForms(
  manifest: CoverageManifest,
  caller: Caller,
): Promise<CaseCheck<CoverageFormKey, FormCheck>> {
  const filter = await myWorkspaceIds(caller);
  const workspaces = await Promise.all(
    COVERAGE_WORKSPACE_KEYS.map((key) => checkWorkspaceForms(manifest, caller, key, filter)),
  );
  return {
    results: workspaces.flatMap((w) => w.results),
    issues: workspaces.flatMap((w) => w.issues),
  };
}

/** The designer's forms list, across the coverage workspaces the actor is an active member of. */
async function coverageDesignList(
  manifest: CoverageManifest,
  actorId: string,
): Promise<Set<string>> {
  const coverage = new Set(COVERAGE_WORKSPACE_KEYS.map((key) => manifest.workspaces[key].id));
  const workspaceIds = (await getActiveWorkspaceIdsForUser(actorId)).filter((id) =>
    coverage.has(id),
  );
  const grant = await resolveFormAccessGrant(actorId, [Permissions.form_read], workspaceIds);
  return new Set(await designFormsList(workspaceIds, grant));
}

/** The actor's permission codes on each coverage form, by form id. */
async function coverageFormPermissions(
  manifest: CoverageManifest,
  actorId: string,
): Promise<Map<string, Set<string>>> {
  const entries = await Promise.all(
    COVERAGE_FORM_KEYS.map(async (key) => {
      const { workspaceId, formId } = manifest.forms[key];
      return [formId, await resolveFormPermissions(actorId, workspaceId, formId)] as const;
    }),
  );
  return new Map(entries);
}

const NO_DESIGN_ACCESS: Record<DesignCheck, boolean> = {
  designListed: false,
  designRead: false,
  designUpdate: false,
  submissionsRead: false,
  staffTemplates: false,
};

const designAnswers = (
  permissions: ReadonlySet<string>,
  listed: boolean,
): Record<DesignCheck, boolean> => {
  const grants = (...codes: PermissionCode[]) => hasAllPermissions(permissions, codes);
  return {
    designListed: listed,
    designRead: grants(Permissions.form_read),
    designUpdate: grants(Permissions.design_update),
    submissionsRead: grants(Permissions.submission_read),
    staffTemplates: grants(Permissions.form_read, Permissions.document_template_read),
  };
};

async function checkDesign(
  manifest: CoverageManifest,
  caller: Caller,
): Promise<CaseCheck<CoverageFormKey, DesignCheck>> {
  const resultOf = (key: CoverageFormKey, actual: Record<DesignCheck, boolean>) => ({
    persona: caller.persona,
    caseKey: key,
    actual,
    expected: expectedOf(DESIGN_CHECKS, DESIGN_EXPECTATIONS[key], caller.persona),
  });
  const actorId = signedInActorId(caller);
  // The design routes need a signed-in caller, so the public user never reaches them.
  if (!actorId) {
    return {
      results: COVERAGE_FORM_KEYS.map((key) => resultOf(key, NO_DESIGN_ACCESS)),
      issues: [],
    };
  }
  const [permissions, listed] = await Promise.all([
    coverageFormPermissions(manifest, actorId),
    coverageDesignList(manifest, actorId),
  ]);
  const issues = await Promise.all(
    COVERAGE_WORKSPACE_KEYS.map((key) =>
      designListInconsistencies(manifest, caller.persona, actorId, key, permissions),
    ),
  );
  const results = COVERAGE_FORM_KEYS.map((key) => {
    const { formId } = manifest.forms[key];
    return resultOf(key, designAnswers(permissions.get(formId) ?? new Set(), listed.has(formId)));
  });
  return { results, issues: issues.flat() };
}

/** Membership in the workspace, then the role check the members and groups reads use. */
async function workspaceAnswers(
  caller: Caller,
  workspaceId: string,
): Promise<Record<WorkspaceCheck, boolean>> {
  const actorId = signedInActorId(caller);
  if (!actorId) return { peopleRead: false };
  const role = (await findActorMembership(workspaceId, actorId))?.role ?? null;
  return { peopleRead: isWorkspacePeopleReadRole(role) };
}

async function checkWorkspaces(
  manifest: CoverageManifest,
  caller: Caller,
): Promise<CaseResult<CoverageWorkspaceKey, WorkspaceCheck>[]> {
  return Promise.all(
    COVERAGE_WORKSPACE_KEYS.map(async (key) => ({
      persona: caller.persona,
      caseKey: key,
      actual: await workspaceAnswers(caller, manifest.workspaces[key].id),
      expected: expectedOf(WORKSPACE_CHECKS, WORKSPACE_EXPECTATIONS[key], caller.persona),
    })),
  );
}

async function checkSubmissions(
  manifest: CoverageManifest,
  caller: Caller,
): Promise<CaseResult<CoverageSubmissionKey, SubmissionCheck>[]> {
  const mine = await mySubmissionIds(caller);
  return Promise.all(
    COVERAGE_SUBMISSION_KEYS.map(async (key) => ({
      persona: caller.persona,
      caseKey: key,
      actual: await submissionAnswers(caller, manifest.submissions[key], mine),
      expected: expectedOf(SUBMISSION_CHECKS, SUBMISSION_EXPECTATIONS[key], caller.persona),
    })),
  );
}

const skipsOwner = (manifest: CoverageManifest): boolean =>
  manifest.personas[OWNER].identityProviderCode !== OWNER_PROVIDER;

/**
 * Every persona against every form, workspace and submission in the coverage set. Personas run in
 * turn and each persona's cases together, which bounds how many queries wait for a pooled
 * connection.
 */
export async function checkCoverage(manifest: CoverageManifest): Promise<CoverageReport> {
  const ownerProvider = manifest.personas[OWNER].identityProviderCode;
  const personas = PERSONA_KEYS.filter((persona) => persona !== OWNER || !skipsOwner(manifest));
  const checked = await inSequence(personas, async (persona) => {
    const caller = callerOf(manifest, persona);
    const [forms, design, workspaces, submissions] = await Promise.all([
      checkForms(manifest, caller),
      checkDesign(manifest, caller),
      checkWorkspaces(manifest, caller),
      checkSubmissions(manifest, caller),
    ]);
    return { forms, design, workspaces, submissions };
  });
  return {
    personas,
    skipped: skipsOwner(manifest)
      ? [`${OWNER}: signs in through ${ownerProvider}, the table assumes ${OWNER_PROVIDER}`]
      : [],
    forms: checked.flatMap((c) => c.forms.results),
    design: checked.flatMap((c) => c.design.results),
    workspaces: checked.flatMap((c) => c.workspaces),
    submissions: checked.flatMap((c) => c.submissions),
    inconsistencies: checked.flatMap((c) => [...c.forms.issues, ...c.design.issues]),
  };
}

const formNameOf = (manifest: CoverageManifest, formId: string): string =>
  Object.values(manifest.forms).find((form) => form.formId === formId)?.name ?? formId;

export type ExplainLine = [label: string, value: string];

const yesNo = (value: boolean): string => (value ? 'yes' : 'no');

const answerLines = <TCheck extends string>(
  actual: Record<TCheck, boolean>,
  expected: Record<TCheck, boolean>,
): ExplainLine[] =>
  (Object.keys(actual) as TCheck[]).map((check) => [
    check,
    actual[check] === expected[check]
      ? yesNo(actual[check])
      : `${yesNo(actual[check])}, expected ${yesNo(expected[check])}`,
  ]);

/** The facts one form's rules read for one persona, and each answer. */
export async function explainForm(
  manifest: CoverageManifest,
  persona: PersonaKey,
  formKey: CoverageFormKey,
): Promise<ExplainLine[]> {
  const caller = callerOf(manifest, persona);
  const actorId = signedInActorId(caller);
  const form = manifest.forms[formKey];
  const facts = await findSubmitterFormFacts({
    userId: actorId,
    workspaceId: form.workspaceId,
    formId: form.formId,
  });
  const published = await getPublishedVersionForForm(form.workspaceId, form.formId);
  const rows = await myFormRows(caller, form.workspaceId);
  const answers = { listed: rows.has(form.formId), ...(await formAnswers(caller, form)) };
  const design = actorId
    ? designAnswers(
        await resolveFormPermissions(actorId, form.workspaceId, form.formId),
        (await coverageDesignList(manifest, actorId)).has(form.formId),
      )
    : NO_DESIGN_ACCESS;
  const idp = { idpCode: caller.identity.idpCode };

  return [
    ['persona', `${persona} (${caller.identity.idpCode}) ${caller.identity.actorId}`],
    ['form', `${form.name} ${form.formId}`],
    ['form live', yesNo((await getWorkspaceIdForForm(form.formId)) !== null)],
    ['published version', published?.id ?? 'none'],
    ['permissions', facts?.permissions.join(', ') || 'none'],
    ['audience', facts ? `${facts.audienceMode} [${facts.audienceIdps.join(', ')}]` : 'none'],
    ['drafts', facts ? draftSaveStatusOf(facts) : 'none'],
    [
      'roles grant open',
      yesNo(
        caller.identity.idpCode !== PUBLIC_PROVIDER_CODE &&
          hasAllPermissions(facts?.permissions ?? [], [Permissions.submission_create]),
      ),
    ],
    ['audience admits', yesNo(!!facts && audienceAdmits(facts, idp))],
    ...answerLines(answers, expectedOf(FORM_CHECKS, FORM_EXPECTATIONS[formKey], persona)),
    ...answerLines(design, expectedOf(DESIGN_CHECKS, DESIGN_EXPECTATIONS[formKey], persona)),
  ];
}

/** One persona's grants on one submission, and each answer. */
export async function explainSubmission(
  manifest: CoverageManifest,
  persona: PersonaKey,
  key: CoverageSubmissionKey,
): Promise<ExplainLine[]> {
  const caller = callerOf(manifest, persona);
  const ref = manifest.submissions[key];
  const live = await getSubmissionWorkspaceAndState(ref.submissionId);
  const grants = caller.identity.actorId
    ? await db
        .select({ role: submissionParticipants.role, status: submissionParticipants.status })
        .from(submissionParticipants)
        .where(
          and(
            eq(submissionParticipants.submissionId, ref.submissionId),
            eq(submissionParticipants.userId, caller.identity.actorId),
          ),
        )
    : [];
  const answers = await submissionAnswers(caller, ref, await mySubmissionIds(caller));

  return [
    ['persona', `${persona} (${caller.identity.idpCode}) ${caller.identity.actorId}`],
    ['submission', ref.submissionId],
    ['form', formNameOf(manifest, ref.formId)],
    ['state', live?.workflowState ?? 'deleted'],
    ['grants', grants.map((g) => `${g.role} ${g.status}`).join(', ') || 'none'],
    [
      'open rule on the form',
      yesNo(await hasFormSubmitAccess(ref, caller.identity, Permissions.submission_create)),
    ],
    ...answerLines(answers, expectedOf(SUBMISSION_CHECKS, SUBMISSION_EXPECTATIONS[key], persona)),
  ];
}
