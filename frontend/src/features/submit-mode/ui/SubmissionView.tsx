'use client';

import { useParams } from 'next/navigation';
import { InlineAlert } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useDictionary } from '@/app/[lang]/Providers';
import { SubmissionDetail } from '@/src/features/submissions/ui/SubmissionDetail';
import { SubmissionLoadAlert } from '@/src/features/submissions/ui/SubmissionLoadAlert';
import { useSubmitSubmission } from '@/src/features/submit-mode/data/useSubmitSubmission';

/** A submitter's view of one submission; `success` is the confirmation shown right after submit. */
export function SubmissionView({ success = false }: Readonly<{ success?: boolean }>) {
  const params = useParams();
  const dict = useDictionary();

  const submissionIdRaw = params?.submissionId;
  const submissionId =
    typeof submissionIdRaw === 'string' ? decodeURIComponent(submissionIdRaw) : '';

  const { data, isLoading, error } = useSubmitSubmission(submissionId);

  const renderContent = () => {
    // A failed background revalidation keeps the submission already on screen.
    if (data) {
      const detail = (
        <SubmissionDetail
          submission={data.submission}
          schema={data.schema}
          content={data.content}
        />
      );
      if (!success) return detail;
      if (data.submission.workflowState !== 'submitted') {
        return (
          <InlineAlert
            variant="info"
            role="status"
            title={dict.submission.success.notSubmitted}
            data-testid="submission-success-not-submitted"
          />
        );
      }
      return (
        <div data-testid="submission-success">
          <div className="mb-3">
            <InlineAlert
              variant="success"
              role="status"
              title={dict.submission.success.message}
              description={dict.submission.success.keepConfirmation}
            />
          </div>
          {detail}
        </div>
      );
    }
    if (error) return <SubmissionLoadAlert error={error} />;
    if (isLoading) return <CenteredProgress label={dict.general.loading} />;
    return <SubmissionLoadAlert error={{ kind: 'notFound', cause: null }} />;
  };

  return (
    <div className="mt-3" data-testid="submission-view">
      {renderContent()}
    </div>
  );
}
