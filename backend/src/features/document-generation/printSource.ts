import {
  PrintStatus,
  SUBMISSION_CONFIRMED_STATES,
  SubmissionWorkflowState,
  type PrintStatusCode,
} from '@soba/lib';
import type { PrintContext } from '../../core/integrations/document-generation/DocumentGenerationAdapter';

/** A form-engine answer document; the answers are under `data`. */
type AnswerDocument = Record<string, unknown>;

/** What a print renders and the status it carries. */
export interface PrintSource {
  data: AnswerDocument;
  status: PrintStatusCode;
}

/**
 * Answers sent with a print render as unsaved, wrapped as an engine document; otherwise the saved
 * answers render. Null when there are neither.
 */
export function printSourceOf(input: {
  saved: AnswerDocument | null;
  sent?: Record<string, unknown>;
  workflowState: string;
}): PrintSource | null {
  const { saved, sent, workflowState } = input;
  if (sent) return { data: { data: sent }, status: PrintStatus.unsaved };
  if (!saved) return null;
  const submitted = workflowState === SubmissionWorkflowState.submitted;
  return { data: saved, status: submitted ? PrintStatus.submitted : PrintStatus.draft };
}

/**
 * The print context of a render of the submission. The confirmation code goes with saved answers
 * once the submission is confirmed, as the app shows it.
 */
export const printContextOf = (
  submission: { confirmationCode: string; currentRevisionNo: number; workflowState: string },
  status: PrintStatusCode,
  now = new Date(),
): PrintContext => {
  const savedAnswers = status !== PrintStatus.unsaved;
  const confirmed = (SUBMISSION_CONFIRMED_STATES as readonly string[]).includes(
    submission.workflowState,
  );
  return {
    status,
    printedAt: now.toISOString(),
    confirmationCode: savedAnswers && confirmed ? submission.confirmationCode : null,
    revisionNo: savedAnswers ? submission.currentRevisionNo : null,
  };
};
