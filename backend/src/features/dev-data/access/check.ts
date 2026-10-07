/**
 * Runs every coverage case through the code the submit routes use, and compares the answers with
 * the expectations table. Reads only.
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
} from '@soba/lib';

import { db } from '../../../core/db/client';
import { submissionParticipants } from '../../../core/db/schema';
import { getWorkspaceIdForForm } from '../../../core/db/repos/formRepo';
import {
  hasFormSubmitAccess,
  type CallerIdentity,
} from '../../../core/db/repos/formSubmitAccessRepo';
import { getPublishedVersionForForm } from '../../../core/db/repos/formVersionRepo';
import {
  getSubmissionWorkspaceAndState,
  listSubmissionsForParticipant,
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
import { findActiveManifest } from '../runs';
import {
  expectedOf,
  FORM_CHECKS,
  FORM_EXPECTATIONS,
  SUBMISSION_CHECKS,
  SUBMISSION_EXPECTATIONS,
  type CaseResult,
  type FormCheck,
  type SubmissionCheck,
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
  type PersonaKey,
} from './plan';

export interface CoverageReport {
  /** Personas whose cases were checked. */
  personas: PersonaKey[];
  /** Why a persona was left out. */
  skipped: string[];
  forms: CaseResult<CoverageFormKey, FormCheck>[];
  submissions: CaseResult<CoverageSubmissionKey, SubmissionCheck>[];
  /** Disagreements between two code paths that should give the same answer. */
  inconsistencies: string[];
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

/** My Forms rows in the workspace, by form id. */
async function myFormRows(
  caller: Caller,
  workspaceId: string,
): Promise<Map<string, SubmitterFormListRow>> {
  if (!caller.signedIn || !caller.identity.actorId) return new Map();
  const { items } = await listFormsForSubmitter({
    userId: caller.identity.actorId,
    offset: 0,
    limit: MAX_ROWS,
    workspaceId,
    sort: 'name:asc',
    locale: DEFAULT_SORT_LOCALE,
  });
  return new Map(items.map((row) => [row.id, row]));
}

async function myWorkspaceIds(caller: Caller): Promise<Set<string>> {
  if (!caller.signedIn || !caller.identity.actorId) return new Set();
  const rows = await listWorkspacesForSubmitter({
    userId: caller.identity.actorId,
    limit: MAX_ROWS,
    locale: DEFAULT_SORT_LOCALE,
  });
  return new Set(rows.map((row) => row.id));
}

async function mySubmissionIds(caller: Caller): Promise<Set<string>> {
  if (!caller.signedIn || !caller.identity.actorId) return new Set();
  const { items } = await listSubmissionsForParticipant({
    userId: caller.identity.actorId,
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

async function checkForms(
  manifest: CoverageManifest,
  caller: Caller,
  report: CoverageReport,
): Promise<void> {
  const filter = await myWorkspaceIds(caller);
  for (const workspaceKey of COVERAGE_WORKSPACE_KEYS) {
    const workspaceId = manifest.workspaces[workspaceKey].id;
    const rows = await myFormRows(caller, workspaceId);
    const formKeys = COVERAGE_FORM_KEYS.filter(
      (key) => manifest.forms[key].workspaceId === workspaceId,
    );
    for (const formKey of formKeys) {
      const form = manifest.forms[formKey];
      const row = rows.get(form.formId);
      const answers = await formAnswers(caller, form);
      if (row) report.inconsistencies.push(...rowInconsistencies(caller, formKey, row, answers));
      report.forms.push({
        persona: caller.persona,
        caseKey: formKey,
        actual: { listed: !!row, ...answers },
        expected: expectedOf(FORM_CHECKS, FORM_EXPECTATIONS[formKey], caller.persona),
      });
    }
    const listedHere = rows.size > 0;
    if (listedHere !== filter.has(workspaceId)) {
      report.inconsistencies.push(
        `${caller.persona} x ${workspaceKey}: My Forms filter disagrees with the listed forms`,
      );
    }
  }
}

async function checkSubmissions(
  manifest: CoverageManifest,
  caller: Caller,
  report: CoverageReport,
): Promise<void> {
  const mine = await mySubmissionIds(caller);
  for (const key of COVERAGE_SUBMISSION_KEYS) {
    report.submissions.push({
      persona: caller.persona,
      caseKey: key,
      actual: await submissionAnswers(caller, manifest.submissions[key], mine),
      expected: expectedOf(SUBMISSION_CHECKS, SUBMISSION_EXPECTATIONS[key], caller.persona),
    });
  }
}

/** Every persona against every form and submission in the coverage set. */
export async function checkCoverage(manifest: CoverageManifest): Promise<CoverageReport> {
  const report: CoverageReport = {
    personas: [],
    skipped: [],
    forms: [],
    submissions: [],
    inconsistencies: [],
  };
  for (const persona of PERSONA_KEYS) {
    const provider = manifest.personas[persona].identityProviderCode;
    if (persona === OWNER && provider !== OWNER_PROVIDER) {
      report.skipped.push(
        `${OWNER}: signs in through ${provider}, the table assumes ${OWNER_PROVIDER}`,
      );
      continue;
    }
    const caller = callerOf(manifest, persona);
    report.personas.push(persona);
    await checkForms(manifest, caller, report);
    await checkSubmissions(manifest, caller, report);
  }
  return report;
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
  const form = manifest.forms[formKey];
  const facts = await findSubmitterFormFacts({
    userId: caller.signedIn ? (caller.identity.actorId ?? null) : null,
    workspaceId: form.workspaceId,
    formId: form.formId,
  });
  const published = await getPublishedVersionForForm(form.workspaceId, form.formId);
  const rows = await myFormRows(caller, form.workspaceId);
  const answers = { listed: rows.has(form.formId), ...(await formAnswers(caller, form)) };
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
