// Submit-mode API service: submission open/save/submit, reads of an existing submission, and the
// caller's own list and delete. All calls hit /submit/*. The token is optional except on the list and
// delete; the backend attributes anonymous callers to the seeded public user. Opening needs the form's
// audience; reading an existing submission needs participation in it, and writing it needs both.
import { sobaFetch } from './sobaFetch';
import { parseJson } from './sobaHelpers';
import { sortLocaleHeaders } from './sortLocaleRequest';
import { toListRequestQuery, type ListQueryArgs } from '@/src/types/list';
import { FormType } from '@formio/react';
import type { SubmitFillBundle, SubmissionDataDocument } from '../../types/forms';
import type {
  SubmissionDataBody,
  SubmissionResponse,
  SubmissionWriteResponse,
  SubmissionListItem,
  SubmitSubmissionBody,
  ListMySubmissionsResponse,
  MySubmissionState,
} from '@/src/types/submissions';

/**
 * The one payload the fill page needs: workflow state, form version, head revision, schema, any
 * saved answers (resume) and whether the caller may write and save a draft.
 */
export async function getSubmitFillBundle(
  token: string | undefined,
  submissionId: string,
): Promise<SubmitFillBundle> {
  const response = await sobaFetch(`/submit/submissions/${submissionId}/fill`, { token });
  return parseJson<SubmitFillBundle>(response);
}

/** A submission's own form-version schema, for its read-only confirmation view. */
export async function getSubmitSubmissionSchema(
  token: string | undefined,
  submissionId: string,
): Promise<FormType | null> {
  const response = await sobaFetch(`/submit/submissions/${submissionId}/schema`, { token });
  if (response.status === 404) return null;
  return parseJson(response);
}

/**
 * Open a SOBA submission (a PG row in the `opened` state) under a client-minted id (uuidv7); its
 * answer data is written later via saveSobaFormSubmission (draft) or submitSobaFormSubmission (submit).
 * The create is idempotent on the id, so a retry with the same id returns the same record. A
 * formVersionId must be the published version (409 otherwise). Token is optional: anonymous
 * submissions to a public-audience form are attributed to the public user.
 */
export async function openSobaFormSubmission(
  token: string | undefined,
  formId: string,
  id: string,
  formVersionId?: string,
): Promise<SubmissionResponse> {
  const response = await sobaFetch('/submit/submissions', {
    token,
    method: 'POST',
    json: { id, formId, formVersionId },
  });
  return parseJson<SubmissionResponse>(response);
}

/**
 * Save a submission's answer data as a draft, without engine validation; the server writes a new
 * engine document + revision. `revision.status` reports whether the save became current or was held
 * as pending.
 */
export async function saveSobaFormSubmission(
  token: string | undefined,
  submissionId: string,
  body: SubmissionDataBody,
): Promise<SubmissionWriteResponse> {
  const response = await sobaFetch(`/submit/submissions/${submissionId}/save`, {
    token,
    method: 'POST',
    json: body,
  });
  return parseJson<SubmissionWriteResponse>(response);
}

/**
 * Submit a submission's answer data. `revision.status` is `current` when the submit landed, or
 * `pending` when it was held for review (a conflict, or a submit against an already-submitted
 * record). A retry with the same revisionId replays the recorded revision.
 */
export async function submitSobaFormSubmission(
  token: string | undefined,
  submissionId: string,
  body: SubmitSubmissionBody,
): Promise<SubmissionWriteResponse> {
  const response = await sobaFetch(`/submit/submissions/${submissionId}/submit`, {
    token,
    method: 'POST',
    json: body,
  });
  return parseJson<SubmissionWriteResponse>(response);
}

/** One page of the caller's own draft and submitted submissions; signed-in callers only. */
export async function getMySubmissions(
  token: string,
  args: ListQueryArgs & { workflowState?: MySubmissionState },
): Promise<ListMySubmissionsResponse> {
  const response = await sobaFetch('/submit/submissions/mine', {
    token,
    query: { ...toListRequestQuery(args), workflowState: args.workflowState },
    headers: sortLocaleHeaders(args.locale),
  });
  return parseJson(response);
}

/** Delete the caller's own unsubmitted submission. A 404 counts as deleted. */
export async function deleteSubmitSubmission(token: string, submissionId: string): Promise<void> {
  const response = await sobaFetch(`/submit/submissions/${submissionId}`, {
    token,
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 404) await parseJson(response);
}

/** Read a submission's metadata for the confirmation view. */
export async function getSubmitSubmission(
  token: string | undefined,
  id: string,
): Promise<SubmissionListItem> {
  const response = await sobaFetch(`/submit/submissions/${id}`, { token });
  return parseJson(response);
}

/** Read a submission's answer document for the confirmation view (null if not yet provisioned). */
export async function getSubmitSubmissionData(
  token: string | undefined,
  submissionId: string,
): Promise<SubmissionDataDocument | null> {
  const response = await sobaFetch(`/submit/submissions/${submissionId}/data`, { token });
  if (response.status === 404) return null;
  return parseJson<SubmissionDataDocument>(response);
}
