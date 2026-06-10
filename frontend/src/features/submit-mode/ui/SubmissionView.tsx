'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { FormioProvider } from '@formio/react';
import type { FormType, Submission } from '@formio/react';
import { Alert, Spinner } from 'react-bootstrap';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import { useAppSelector } from '@/lib/store';
import {
  getSobaSubmission,
  getFormVersionSchema,
  getSobaSubmissionData,
} from '@/src/shared/api/sobaApiForms';
import type { SubmissionListItem } from '@/src/types/submissions';

const Form = dynamic(() => import('@formio/react').then((m) => m.Form), {
  ssr: false,
  loading: () => <p className="text-muted small">Loading…</p>,
});

export function SubmissionView() {
  const params = useParams();
  const dict = useDictionary();
  const dictSub = dict.submission;
  const { authenticated, token, initializing } = useKeycloak();
  const { activeWorkspaceId } = useAppSelector((state) => state.workspace);
  const ws = activeWorkspaceId || undefined;

  const submissionIdRaw = params?.submissionId;
  const submissionId =
    typeof submissionIdRaw === 'string' ? decodeURIComponent(submissionIdRaw) : '';

  const [submission, setSubmission] = useState<SubmissionListItem | null>(null);
  const [schema, setSchema] = useState<FormType | null>(null);
  const [data, setData] = useState<Submission['data']>({});
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
        const [loadedSchema, content] = await Promise.all([
          getFormVersionSchema(token, sub.formVersionId, ws),
          getSobaSubmissionData(token, submissionId, ws),
        ]);
        if (!active) return;
        if (loadedSchema) setSchema(loadedSchema);
        setData((content?.data ?? {}) as Submission['data']);
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
                    {dictSub?.submittedOn || 'Submitted'}{' '}
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }).format(new Date(submission.submittedAt))}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {schema ? (
            <div className="formio-v5-chrome" data-soba-formio-chrome data-testid="submission-view-form">
              <FormioProvider>
                <Form
                  className="formio-v5-form-root"
                  src=""
                  form={schema}
                  submission={{ data }}
                  options={{ readOnly: true }}
                />
              </FormioProvider>
            </div>
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
