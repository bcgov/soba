'use client';

import { useDictionary } from '@/app/[lang]/Providers';
import type { DataError } from '@/src/shared/api/dataContracts';
import { classifyDataError } from '@/src/shared/api/dataError';
import { LoadErrorAlert } from '@/src/shared/ui/LoadErrorAlert';

export type SubmissionLoadFailure = 'sessionExpired' | 'noAccess' | 'notFound' | 'loadFailed';

const FAILURE_KIND: Record<SubmissionLoadFailure, DataError['kind']> = {
  sessionExpired: 'sessionExpired',
  noAccess: 'forbidden',
  notFound: 'notFound',
  loadFailed: 'failed',
};

/** Only a 404 means the submission is missing; any other failure is a failed load. */
export function submissionLoadFailure(error: unknown): SubmissionLoadFailure {
  const { kind } = classifyDataError(error);
  if (kind === 'sessionExpired') return 'sessionExpired';
  if (kind === 'forbidden') return 'noAccess';
  if (kind === 'notFound') return 'notFound';
  return 'loadFailed';
}

export function SubmissionLoadAlert({ failure }: Readonly<{ failure: SubmissionLoadFailure }>) {
  const dict = useDictionary();
  return (
    <LoadErrorAlert
      error={{ kind: FAILURE_KIND[failure], cause: null }}
      messages={{
        sessionExpired: dict.general.sessionExpired,
        forbidden: dict.general.noAccess,
        notFound: dict.submission.notFound,
        failed: dict.submission.loadError,
      }}
      testIds={{
        sessionExpired: 'submission-view-session-expired',
        forbidden: 'submission-view-noaccess',
        notFound: 'submission-view-notfound',
        failed: 'submission-view-loaderror',
      }}
    />
  );
}
