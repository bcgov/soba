import type { MySubmissionListItem, SubmitterForm } from '@soba/lib';

export type {
  SubmissionListItem,
  SubmissionResponse,
  SubmissionRevisionInfo,
  SubmissionWriteResponse,
  ListSubmissionsResponse,
  SubmissionDataBody,
  SubmitSubmissionBody,
  MySubmissionListItem,
  MySubmissionState,
  ListMySubmissionsResponse,
} from '@soba/lib';
export { MY_SUBMISSION_STATES } from '@soba/lib';

/** A My Submissions row with its form's facts for the caller; null when the page carried none. */
export type MySubmissionRow = MySubmissionListItem & { form: SubmitterForm | null };
