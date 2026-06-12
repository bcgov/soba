'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormType, Submission } from '@formio/react';
import { Alert, Spinner } from 'react-bootstrap';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import { useAppSelector } from '@/lib/store';
import { ReadOnlyFormView } from '@/src/features/formio-v5/ui/ReadOnlyFormView';
import { useFormatLongDate } from '@/src/shared/hooks/useFormatLongDate';
import {
  getSobaSubmission,
  getFormVersionSchema,
  getSobaSubmissionData,
} from '@/src/shared/api/sobaApiForms';
import type { SubmissionListItem } from '@/src/types/submissions';

export function SubmissionView() {
  const params = useParams();
  const dict = useDictionary();
  const dictSub = dict.submission;
  const { authenticated, token, initializing } = useKeycloak();
  const { activeWorkspaceId } = useAppSelector((state) => state.workspace);
  const ws = activeWorkspaceId || undefined;
  const formatLongDate = useFormatLongDate();

  const submissionIdRaw = params?.submissionId;
  const submissionId =
    typeof submissionIdRaw === 'string' ? decodeURIComponent(submissionIdRaw) : '';

  const [submission, setSubmission] = useState<SubmissionListItem | null>(null);
  const [schema, setSchema] = useState<FormType | null>(null);
  // null = no engine document (submission has no saved answers); {} = empty answers on a real doc.
  const [content, setContent] = useState<{ data?: Record<string, unknown> } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!authenticated || !token || loaded) return;
    let active = true;
    void (async () => {
      try {
        const sub = await getSobaSubmission(token, submissionId, ws);
        if (!active) return;
        setSubmission(sub);
        const [loadedSchema, fetchedContent] = await Promise.all([
          getFormVersionSchema(token, sub.formVersionId, ws),
          getSobaSubmissionData(token, submissionId, ws),
        ]);
        if (!active) return;
        if (loadedSchema) setSchema(loadedSchema);
        setContent(fetchedContent);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [authenticated, token, submissionId, ws, loaded]);

  if (initializing || (authenticated && !token)) {
    return (
      <div className="p-5 text-center">
        <Spinner animation="border" />
      </div>
    );
  }
  if (!authenticated) return null;

  return (
    <div className="mt-3" data-testid="submission-view">
      {!loaded ? (
        <p className="text-muted small">{dictSub?.loading || 'Loading…'}</p>
      ) : notFound || !submission ? (
        <Alert variant="danger" role="alert" data-testid="submission-view-notfound">
          {dictSub?.notFound || 'Submission not found.'}
        </Alert>
      ) : (
        <>
          <div className="mb-3" data-testid="submission-view-header">
            <h2 className="h5 mb-1">{submission.formName || dict.form?.nameLabel || 'Submission'}</h2>
            <div className="small text-muted">
              <span data-testid="submission-view-version">v{submission.versionNo ?? 1}</span>
              {' · '}
              <span data-testid="submission-view-status">
                {(submission.workflowState || '').toUpperCase()}
              </span>
              {submission.submittedAt ? (
                <>
                  {' · '}
                  <span data-testid="submission-view-submitted">
                    {dictSub?.submittedOn || 'Submitted'} {formatLongDate(submission.submittedAt)}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {schema && content !== null ? (
            <ReadOnlyFormView
              schema={schema}
              submission={{ data: (content.data ?? {}) as Submission['data'] }}
              testId="submission-view-form"
            />
          ) : (
            <Alert variant="secondary" role="alert" data-testid="submission-view-nocontent">
              {dictSub?.noContent || 'No submitted answers to display.'}
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
