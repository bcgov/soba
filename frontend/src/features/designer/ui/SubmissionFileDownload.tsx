'use client';

import { FileDownload } from '@/src/shared/ui/FileDownload';
import { submissionFileLoader } from '@/src/features/designer/data/submissionFile';

type SubmissionFileDownloadProps = {
  submissionId: string;
  fileId: string;
};

/** Saves a submission's attachment, for staff. */
export function SubmissionFileDownload({
  submissionId,
  fileId,
}: Readonly<SubmissionFileDownloadProps>) {
  return <FileDownload load={submissionFileLoader(submissionId, fileId)} />;
}
