'use client';

import { useParams } from 'next/navigation';
import type { Submission } from '@formio/react';
import { InlineAlert } from '@bcgov/design-system-react-components';
import { ReadOnlyFormView } from '@/src/features/formio-v5/ui/ReadOnlyFormView';
import { useFormatLongDate } from '@/src/shared/hooks/useFormatLongDate';
import { convertSubmissionIdToConfirmationId } from '@/src/shared/util/stringUtils';
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

export function SubmissionView({ success = false }: Readonly<{ success?: boolean }>) {
  const params = useParams();
  const dict = useDictionary();
  const dictSub = dict.submission;
  const formatLongDate = useFormatLongDate();
  // Token optional: a public submitter can view a submission on a public-audience form.
  const { token, initializing, initStarted } = useKeycloak();

  const submissionIdRaw = params?.submissionId;
  const submissionId =
    typeof submissionIdRaw === 'string' ? decodeURIComponent(submissionIdRaw) : '';

  const confirmationId = convertSubmissionIdToConfirmationId(submissionId).toLocaleUpperCase();

  const { data, isLoading, error } = useMaybeAuthedSWR(
    // Wait for Keycloak to answer before reading. Before init, "no token" is the default rather
    // than an answer, and a read started there is anonymous even for a signed-in caller.
    // The identity is part of the key so signing in does not read the anonymous reader's copy.
    !initStarted || initializing || !submissionId
      ? null
      : ['submit-submission', submissionId, token ? 'user' : 'anonymous', success],
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
      const { submission, schema, content } = data;
      const formContent =
        schema && content != null ? (
          <ReadOnlyFormView
            schema={schema}
            submission={{ data: (content.data ?? {}) as Submission['data'] }}
            testId="submission-view-form"
          />
        ) : (
          <InlineAlert variant="info" role="alert" data-testid="submission-view-nocontent">
            {dictSub?.noContent || 'No submitted answers to display.'}
          </InlineAlert>
        );

      if (success) {
        if (submission.workflowState !== 'submitted') {
          return (
            <InlineAlert variant="info" role="status">
              {dictSub.success.notSubmitted}
            </InlineAlert>
          );
        }
        return (
          <div data-testid="submission-success">
            <InlineAlert variant="success" role="status">
              {dictSub.success.message}
            </InlineAlert>
            <h2 className="h3 mt-4">{submission.formName}</h2>
            <p>
              {dictSub.confirmationId}: <strong>{confirmationId}</strong>
            </p>
            <p>{dictSub.success.keepConfirmation}</p>
            {submission.submittedAt ? (
              <p>
                {dictSub.submittedOn} <strong>{formatLongDate(submission.submittedAt)}</strong>
              </p>
            ) : null}

            <hr />
            <div className="mt-4">{formContent}</div>
          </div>
        );
      }
      return <SubmissionDetail submission={submission} schema={schema} content={content} />;
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
