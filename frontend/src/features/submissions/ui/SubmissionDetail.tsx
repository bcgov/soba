'use client';

import type { FormType, Submission } from '@formio/react';
import { InlineAlert } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { StatusTag, submitterReviewToVariant } from '@/src/components/StatusTag';
import { ReadOnlyFormView } from '@/src/features/formio-v5/ui/ReadOnlyFormView';
import { useFormatLongDate } from '@/src/shared/hooks/useFormatLongDate';
import type { SubmissionDataDocument } from '@/src/types/forms';
import type { SubmissionListItem, SubmitterReviewLabel } from '@/src/types/submissions';
import { WorkflowStateBadge } from './WorkflowStateBadge';

const SEPARATOR = ' · ';

type SubmissionDetailProps = {
  submission: SubmissionListItem;
  schema: FormType | null;
  /** null = no engine document (no saved answers); `{}` data = empty answers on a real document. */
  content: SubmissionDataDocument | null;
  showSubmitter?: boolean;
  /** The review as its submitter is told it, shown in place of the workflow state once there is one. */
  reviewLabel?: SubmitterReviewLabel | null;
  /**
   * Lays the submission out as the confirmation screen shows it: the status above the form's name,
   * one line each for the confirmation ID, submitted date and version, and the answers in a card.
   */
  confirmation?: boolean;
};

/** A loaded submission: its header and the answers rendered read-only against its schema. */
export function SubmissionDetail({
  submission,
  schema,
  content,
  showSubmitter = false,
  reviewLabel = null,
  confirmation = false,
}: Readonly<SubmissionDetailProps>) {
  const dict = useDictionary();
  const dictSub = dict.submission;
  const formatLongDate = useFormatLongDate();

  const formName = submission.formName || dict.form.nameLabel;
  const versionNo = submission.versionNo ?? 1;
  const status = reviewLabel ? (
    <StatusTag
      label={dict.mySubmissions.reviewStatuses[reviewLabel]}
      variant={submitterReviewToVariant(reviewLabel)}
      data-testid="submission-view-status"
    />
  ) : (
    <WorkflowStateBadge state={submission.workflowState} data-testid="submission-view-status" />
  );
  const submitter = showSubmitter ? (
    <div data-testid="submission-view-submitter">
      {dictSub.submitter}: {submission.createdBy || dictSub.anon}
    </div>
  ) : null;

  const answers =
    schema && content !== null ? (
      <ReadOnlyFormView
        schema={schema}
        submission={{ data: (content.data ?? {}) as Submission['data'] }}
        testId="submission-view-form"
      />
    ) : (
      <InlineAlert variant="info" role="status" data-testid="submission-view-nocontent">
        {dictSub.noContent}
      </InlineAlert>
    );

  if (confirmation) {
    return (
      <>
        <div className="mt-4 mb-4" data-testid="submission-view-header">
          <div className="mb-2">{status}</div>
          <h2 className="h3 fw-bold mb-3">{formName}</h2>
          <div className="d-flex flex-column gap-2">
            {submission.confirmationCode ? (
              <div data-testid="submission-view-confirmation">
                {dictSub.confirmationId}: {submission.confirmationCode}
              </div>
            ) : null}
            {submitter}
            {submission.submittedAt ? (
              <div data-testid="submission-view-submitted">
                {dictSub.submittedLabel}: {formatLongDate(submission.submittedAt)}
              </div>
            ) : null}
            <div data-testid="submission-view-version">
              {dict.general.version}: {versionNo}
            </div>
          </div>
        </div>
        <div className="border rounded p-4" data-testid="submission-view-answers-card">
          {answers}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-3" data-testid="submission-view-header">
        <h2 className="h5 mb-1">{formName}</h2>
        {submission.confirmationCode ? (
          <div data-testid="submission-view-confirmation">
            {dictSub.confirmationId}: <strong>{submission.confirmationCode}</strong>
          </div>
        ) : null}
        {submitter}
        <div className="small text-muted">
          <span data-testid="submission-view-version">v{versionNo}</span>
          {SEPARATOR}
          {status}
          {submission.submittedAt ? (
            <>
              {SEPARATOR}
              <span data-testid="submission-view-submitted">
                {dictSub.submittedOn} {formatLongDate(submission.submittedAt)}
              </span>
            </>
          ) : null}
        </div>
      </div>
      {answers}
    </>
  );
}
