'use client';

import { InlineAlert } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { isSessionExpired } from '@/src/shared/api/sobaFetch';
import { isForbidden, isNotFound } from '@/src/shared/api/sobaHelpers';

export type SubmissionLoadFailure = 'sessionExpired' | 'noAccess' | 'notFound' | 'loadFailed';

/** Only a 404 means the submission is missing; any other failure is a failed load. */
export function submissionLoadFailure(error: unknown): SubmissionLoadFailure {
  if (isSessionExpired(error)) return 'sessionExpired';
  if (isForbidden(error)) return 'noAccess';
  if (isNotFound(error)) return 'notFound';
  return 'loadFailed';
}

const TEST_IDS: Record<SubmissionLoadFailure, string> = {
  sessionExpired: 'submission-view-session-expired',
  noAccess: 'submission-view-noaccess',
  notFound: 'submission-view-notfound',
  loadFailed: 'submission-view-loaderror',
};

export function SubmissionLoadAlert({ failure }: Readonly<{ failure: SubmissionLoadFailure }>) {
  const dict = useDictionary();
  const messages: Record<SubmissionLoadFailure, string> = {
    sessionExpired: dict.general.sessionExpired,
    noAccess: dict.general.noAccess,
    notFound: dict.submission.notFound,
    loadFailed: dict.submission.loadError,
  };

  return (
    <InlineAlert variant="danger" role="alert" data-testid={TEST_IDS[failure]}>
      {messages[failure]}
    </InlineAlert>
  );
}
