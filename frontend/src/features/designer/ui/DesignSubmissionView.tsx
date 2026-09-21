'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Link } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useDictionary } from '@/app/[lang]/Providers';
import { SubmissionDetail } from '@/src/features/submissions/ui/SubmissionDetail';
import {
  SubmissionLoadAlert,
  submissionLoadFailure,
} from '@/src/features/submissions/ui/SubmissionLoadAlert';
import {
  getFormVersionSchema,
  getSobaSubmission,
  getSobaSubmissionData,
} from '@/src/shared/api/sobaApi';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
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

  const { data, error } = useAuthedSWR(['design-submission', submissionId], async (token) => {
    const submission = await getSobaSubmission(token, submissionId);
    const [schema, content] = await Promise.all([
      getFormVersionSchema(token, submission.formVersionId),
      getSobaSubmissionData(token, submissionId),
    ]);
    return { submission, schema, content };
  });

  const renderContent = () => {
    // A failed background revalidation keeps the submission already on screen.
    if (data) {
      // The URL names the form; a submission from another form is not found under it.
      if (data.submission.formId !== formId) return <SubmissionLoadAlert failure="notFound" />;
      return (
        <SubmissionDetail
          submission={data.submission}
          schema={data.schema}
          content={data.content}
          showSubmitter
        />
      );
    }
    if (error) return <SubmissionLoadAlert failure={submissionLoadFailure(error)} />;
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
