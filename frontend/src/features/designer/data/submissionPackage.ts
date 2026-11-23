import { downloadSobaSubmissionPackage } from '@/src/shared/api/sobaApi';

/** Loads a package of a submission, for staff. */
export const submissionPackageLoader = (submissionId: string, jobId: string) => (token: string) =>
  downloadSobaSubmissionPackage(token, submissionId, jobId);
