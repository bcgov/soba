'use client';

import { useParams } from 'next/navigation';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useDictionary } from '@/app/[lang]/Providers';
import { SubmissionDetail } from '@/src/features/submissions/ui/SubmissionDetail';
import { SubmissionLoadAlert } from '@/src/features/submissions/ui/SubmissionLoadAlert';
import { useSubmitSubmission } from '@/src/features/submit-mode/data/useSubmitSubmission';

export function SubmissionView() {
  const params = useParams();
  const dict = useDictionary();

  const submissionIdRaw = params?.submissionId;
  const submissionId =
    typeof submissionIdRaw === 'string' ? decodeURIComponent(submissionIdRaw) : '';

  const { data, isLoading, error } = useSubmitSubmission(submissionId);

  const renderContent = () => {
    // A failed background revalidation keeps the submission already on screen.
    if (data) {
      return (
        <SubmissionDetail
          submission={data.submission}
          schema={data.schema}
          content={data.content}
        />
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
