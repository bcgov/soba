'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDictionary } from '@/app/[lang]/Providers';
import { FileDownload } from '@/src/shared/ui/FileDownload';
import { submissionPackageLoader } from '@/src/features/designer/data/submissionPackage';
import { getLocaleFromPath } from '@/src/shared/util/locale';

type SubmissionPackageDownloadProps = {
  formId: string;
  submissionId: string;
  jobId: string;
};

/** Saves a package of a submission, for staff. */
export function SubmissionPackageDownload({
  formId,
  submissionId,
  jobId,
}: Readonly<SubmissionPackageDownloadProps>) {
  const dict = useDictionary();
  const locale = getLocaleFromPath(usePathname());
  const load = useMemo(() => submissionPackageLoader(submissionId, jobId), [submissionId, jobId]);
  const text = dict.fileDownload;
  const facts = [
    { name: text.packageId, value: jobId, testId: 'package-id' },
    { name: text.submissionId, value: submissionId, testId: 'submission-id' },
  ];

  return (
    <div className="mt-3">
      <Link
        href={`/${locale}/build/${formId}/submissions/${submissionId}`}
        data-testid="submission-package-back"
      >
        {dict.submission.backToSubmission}
      </Link>
      <FileDownload load={load} notFound={dict.submission.package.notFound} facts={facts} />
    </div>
  );
}
