'use client';

import type { FormType, Submission } from '@formio/react';
import { InlineAlert } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { ReadOnlyFormView } from '@/src/features/formio-v5/ui/ReadOnlyFormView';
import { useFormatLongDate } from '@/src/shared/hooks/useFormatLongDate';
import { convertSubmissionIdToConfirmationId } from '@/src/shared/util/stringUtils';
import type { SubmissionDataDocument } from '@/src/types/forms';
import type { SubmissionListItem } from '@/src/types/submissions';
import { WorkflowStateBadge } from './WorkflowStateBadge';

const SEPARATOR = ' \u00B7 ';

type SubmissionDetailProps = {
  submission: SubmissionListItem;
  schema: FormType | null;
  /** null = no engine document (no saved answers); `{}` data = empty answers on a real document. */
  content: SubmissionDataDocument | null;
  showSubmitter?: boolean;
};

/** A loaded submission: its header and the answers rendered read-only against its schema. */
export function SubmissionDetail({
  submission,
  schema,
  content,
  showSubmitter = false,
}: Readonly<SubmissionDetailProps>) {
  const dict = useDictionary();
  const dictSub = dict.submission;
  const formatLongDate = useFormatLongDate();

  return (
    <>
      <div className="mb-3" data-testid="submission-view-header">
        <h2 className="h5 mb-1">{submission.formName || dict.form.nameLabel}</h2>
        <div>
          {dictSub.confirmationId}: {convertSubmissionIdToConfirmationId(submission.id)}
        </div>
        {showSubmitter ? (
          <div data-testid="submission-view-submitter">
            {dictSub.submitter}: {submission.createdBy || dictSub.anon}
          </div>
        ) : null}
        <div className="small text-muted">
          <span data-testid="submission-view-version">v{submission.versionNo ?? 1}</span>
          {SEPARATOR}
          <WorkflowStateBadge
            state={submission.workflowState}
            data-testid="submission-view-status"
          />
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
    </>
  );
}
