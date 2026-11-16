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

type SubmissionDetailProps = {
  submission: SubmissionListItem;
  schema: FormType | null;
  /** null = no engine document (no saved answers); `{}` data = empty answers on a real document. */
  content: SubmissionDataDocument | null;
  /** The review as its submitter is told it, shown in place of the workflow state once there is one. */
  reviewLabel?: SubmitterReviewLabel | null;
  showConfirmationId?: boolean;
};

/**
 * A loaded submission as its submitter sees it: the status above the form's name, one line each
 * for the confirmation ID, submitted date and version, and the answers rendered read-only in a card.
 */
export function SubmissionDetail({
  submission,
  schema,
  content,
  reviewLabel = null,
  showConfirmationId = true,
}: Readonly<SubmissionDetailProps>) {
  const dict = useDictionary();
  const dictSub = dict.submission;
  const formatLongDate = useFormatLongDate();
  // French sets a space before the colon.
  const sep = dict.general.labelSeparator;

  return (
    <>
      <div className="mt-4 mb-4" data-testid="submission-view-header">
        <div className="mb-2">
          {reviewLabel ? (
            <StatusTag
              label={dict.mySubmissions.reviewStatuses[reviewLabel]}
              variant={submitterReviewToVariant(reviewLabel)}
              data-testid="submission-view-status"
            />
          ) : (
            <WorkflowStateBadge
              state={submission.workflowState}
              data-testid="submission-view-status"
            />
          )}
        </div>
        <h2 className="h3 fw-bold mb-3">{submission.formName || dict.form.nameLabel}</h2>
        <div className="d-flex flex-column gap-2">
          {showConfirmationId && submission.confirmationCode ? (
            <div data-testid="submission-view-confirmation">
              {dictSub.confirmationId}
              {sep}
              <span data-testid="submission-view-confirmation-code">
                {submission.confirmationCode}
              </span>
            </div>
          ) : null}
          {submission.submittedAt ? (
            <div data-testid="submission-view-submitted">
              {dictSub.submittedLabel}
              {sep}
              {formatLongDate(submission.submittedAt)}
            </div>
          ) : null}
          <div data-testid="submission-view-version">
            {dict.general.version}
            {sep}
            {submission.versionNo ?? 1}
          </div>
        </div>
      </div>
      <div className="border rounded p-4" data-testid="submission-view-answers-card">
        {schema && content !== null ? (
          <ReadOnlyFormView
            schema={schema}
            submission={{ data: (content.data ?? {}) as Submission['data'] }}
            testId="submission-view-form"
          />
        ) : (
          <InlineAlert variant="info" role="status" data-testid="submission-view-nocontent">
            {dictSub.noContent}
          </InlineAlert>
        )}
      </div>
    </>
  );
}
