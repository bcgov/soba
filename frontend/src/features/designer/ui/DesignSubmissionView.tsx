'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Link } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useDictionary } from '@/app/[lang]/Providers';
import { SubmissionDetail } from '@/src/features/submissions/ui/SubmissionDetail';
import { SubmissionLoadAlert } from '@/src/features/submissions/ui/SubmissionLoadAlert';
import { useDesignSubmission } from '@/src/features/designer/data/useDesignSubmission';
import { getLocaleFromPath } from '@/src/shared/util/locale';

type DesignSubmissionViewProps = {
  formId: string;
  submissionId: string;
};

/** Staff view of one submission, read through the design API. */
export function DesignSubmissionView({
  formId,
  submissionId,
}: Readonly<DesignSubmissionViewProps>) {
  const dict = useDictionary();
  const router = useRouter();
  const locale = getLocaleFromPath(usePathname());

  const { data, error } = useDesignSubmission(submissionId, formId);

  const renderContent = () => {
    // A failed background revalidation keeps the submission already on screen.
    if (data) {
      return (
        <SubmissionDetail
          submission={data.submission}
          schema={data.schema}
          content={data.content}
          showSubmitter
        />
      );
    }
    if (error) return <SubmissionLoadAlert error={error} />;
    return <CenteredProgress label={dict.general.loading} />;
  };

  return (
    <div className="mt-3" data-testid="design-submission-view">
      <div className="mb-3">
        <Link
          data-testid="design-submission-back"
          onPress={() => router.push(`/${locale}/build/${formId}?tab=submissions`)}
        >
          {dict.submission.backToSubmissions}
        </Link>
      </div>
      {renderContent()}
    </div>
  );
}
