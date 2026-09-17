'use client';

import { useParams } from 'next/navigation';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import { SubmissionDetail } from '@/src/features/submissions/ui/SubmissionDetail';
import {
  SubmissionLoadAlert,
  submissionLoadFailure,
} from '@/src/features/submissions/ui/SubmissionLoadAlert';
import {
  getSubmitSubmission,
  getSubmitSubmissionSchema,
  getSubmitSubmissionData,
} from '@/src/shared/api/sobaApi';
import { useMaybeAuthedSWR } from '@/src/shared/api/useAuthedSWR';

export function SubmissionView() {
  const params = useParams();
  const dict = useDictionary();
  // Token optional: a public submitter can view a submission on a public-audience form.
  const { token, initializing, initStarted } = useKeycloak();

  const submissionIdRaw = params?.submissionId;
  const submissionId =
    typeof submissionIdRaw === 'string' ? decodeURIComponent(submissionIdRaw) : '';

  const { data, isLoading, error } = useMaybeAuthedSWR(
    // Wait for Keycloak to answer before reading. Before init, "no token" is the default rather
    // than an answer, and a read started there is anonymous even for a signed-in caller.
    // The identity is part of the key so signing in does not read the anonymous reader's copy.
    !initStarted || initializing || !submissionId
      ? null
      : ['submit-submission', submissionId, token ? 'user' : 'anonymous'],
    async (authToken) => {
      // The confirmation view is submit-mode: read through the submit APIs regardless of sign-in so
      // audience members who aren't workspace members can still view.
      const submission = await getSubmitSubmission(authToken, submissionId);
      const [schema, content] = await Promise.all([
        getSubmitSubmissionSchema(authToken, submissionId),
        getSubmitSubmissionData(authToken, submissionId),
      ]);
      return { submission, schema, content };
    },
  );

  // Nothing is read until Keycloak answers, and with no read there is no data and no loading, which
  // would otherwise render as "not found".
  if (!initStarted || initializing) {
    return <CenteredProgress label={dict.general.loading} />;
  }

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
    if (error) return <SubmissionLoadAlert failure={submissionLoadFailure(error)} />;
    if (isLoading) return <CenteredProgress label={dict.general.loading} />;
    return <SubmissionLoadAlert failure="notFound" />;
  };

  return (
    <div className="mt-3" data-testid="submission-view">
      {renderContent()}
    </div>
  );
}
