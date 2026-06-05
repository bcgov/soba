'use client';

import { useEffect, useState } from 'react';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import { getSobaSubmissions, getSobaFormVersionFromFormioId } from '@/src/shared/api/sobaApiForms';
import type { SubmissionListItem } from '@/src/types/submissions';
import { DataTable, Column } from '@/src/components/DataTable';
import { useAppSelector } from '@/lib/store';

interface SubmissionListProps {
  formId?: string;
}

export function SubmissionList({ formId }: SubmissionListProps = {}) {
  const { authenticated, token, initializing } = useKeycloak();
  const dict = useDictionary();
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const { activeWorkspaceId } = useAppSelector((state) => state.workspace);

  useEffect(() => {
    if (authenticated && token) {
      const fetchSubmissions = async () => {
        try {
          let resolvedFormId = formId;

          // If formId is provided and doesn't look like a UUID, it might be a Form.io ID.
          // We need to resolve it to a SOBA Form ID first.
          if (formId && formId.length !== 36) {
            try {
              const sobaForm = await getSobaFormVersionFromFormioId(
                token,
                formId,
                activeWorkspaceId || undefined,
              );
              if (sobaForm && sobaForm.id) {
                resolvedFormId = sobaForm.id;
              }
            } catch (err) {
              console.error('Failed to resolve Form.io ID to SOBA Form ID', err);
            }
          }

          const params = resolvedFormId ? { formId: resolvedFormId } : undefined;
          const data = await getSobaSubmissions(token, params, activeWorkspaceId || undefined);
          setSubmissions(data.items || []);
        } catch (err) {
          console.error('Failed to fetch submissions', err);
        } finally {
          setIsLoaded(true);
        }
      };

      fetchSubmissions();
    }
  }, [authenticated, token, formId, activeWorkspaceId]);

  const loading = !!(authenticated && token && !isLoaded);

  if (initializing || (authenticated && !token)) {
    return <div className="p-4">{dict.form?.loading || 'Loading submissions...'}</div>;
  }

  if (!authenticated) {
    return null;
  }

  // Define columns for DataTable
  const columns: Column<SubmissionListItem>[] = [
    {
      key: 'id',
      label: dict.submission?.columns?.id || 'Submission ID',
      render: (sub) => (
        <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{sub.id}</code>
      ),
    },
    {
      key: 'formName',
      label: dict.submission?.columns?.formName || dict.form?.nameLabel || 'Form Name',
      render: (sub) => (
        <span className="text-gray-800 font-semibold">
          {sub.formName || dict.form?.nameLabel || 'Untitled Form'}
        </span>
      ),
    },
    {
      key: 'formId',
      label: dict.submission?.columns?.formId || 'Form ID',
      render: (sub) => <span className="text-gray-500 font-mono text-xs">{sub.formId}</span>,
    },
    {
      key: 'versionNo',
      label: dict.submission?.columns?.version || 'Version',
      render: (sub) => (
        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">
          v{sub.versionNo || 1}
        </span>
      ),
    },
    {
      key: 'workflowState',
      label: dict.submission?.columns?.status || 'Status',
      render: (sub) => (
        <span
          className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full border ${
            sub.workflowState === 'submitted'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {sub.workflowState.toUpperCase()}
        </span>
      ),
    },
  ];

  return (
    <section>
      <div>
        <h2>{dict.submission?.submissions || 'Submissions'}</h2>
      </div>
      <DataTable<SubmissionListItem>
        data={submissions}
        columns={columns}
        loading={loading}
        emptyMessage={dict.submission?.empty || 'No submissions found yet.'}
        loadingMessage={dict.form?.loading || 'Loading submissions...'}
        keyExtractor={(sub) => sub.id}
        itemName={dict.submission?.submissions || 'submissions'}
      />
    </section>
  );
}
