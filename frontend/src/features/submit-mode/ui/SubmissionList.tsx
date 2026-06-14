'use client';

import { useEffect, useMemo, useState } from 'react';
import { Container } from 'react-bootstrap';
import { useRouter, usePathname } from 'next/navigation';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import { getSobaSubmissions } from '@/src/shared/api/sobaApiForms';
import type { SubmissionListItem } from '@/src/types/submissions';
import { DataTable, Column } from '@/src/components/DataTable';
import { useAppSelector } from '@/lib/store';

interface SubmissionListProps {
  formId?: string;
}

export function SubmissionList({ formId }: SubmissionListProps = {}) {
  const { authenticated, token, initializing } = useKeycloak();
  const dict = useDictionary();
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const { activeWorkspaceId } = useAppSelector((state) => state.workspace);

  const paginatedSubmissions = useMemo(
    () => submissions.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [submissions, currentPage, pageSize],
  );

  useEffect(() => {
    if (authenticated && token) {
      const fetchSubmissions = async () => {
        try {
          // `formId` is the SOBA formId (routed from FormList); list submissions for it directly.
          const params = formId ? { formId } : undefined;
          const data = await getSobaSubmissions(token, params, activeWorkspaceId || undefined);
          setSubmissions(data.items || []);
        } catch {
          // Submissions failed to load; the empty state is shown to the user.
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
        <a
          href="#"
          data-testid={`submission-view-${sub.id}`}
          onClick={(e) => {
            e.preventDefault();
            router.push(`/${locale}/submission/${sub.id}`);
          }}
          className="text-decoration-underline font-monospace small"
          style={{ cursor: 'pointer', color: '#00538A' }}
          title={dict.submission?.view || 'View'}
        >
          {sub.id}
        </a>
      ),
    },
    {
      key: 'formName',
      label: dict.submission?.columns?.formName || dict.form?.nameLabel || 'Form Name',
      render: (sub) => (
        <span className="fw-semibold">{sub.formName || dict.form?.nameLabel || 'Untitled Form'}</span>
      ),
    },
    {
      key: 'formId',
      label: dict.submission?.columns?.formId || 'Form ID',
      render: (sub) => <span className="text-muted small font-monospace">{sub.formId}</span>,
    },
    {
      key: 'versionNo',
      label: dict.submission?.columns?.version || 'Version',
      render: (sub) => <span className="small">v{sub.versionNo || 1}</span>,
    },
    {
      key: 'workflowState',
      label: dict.submission?.columns?.status || 'Status',
      render: (sub) => (
        <span
          className={`badge rounded-pill ${
            sub.workflowState === 'submitted' ? 'text-bg-success' : 'text-bg-secondary'
          }`}
        >
          {sub.workflowState.toUpperCase()}
        </span>
      ),
    },
  ];

  return (
    <Container fluid className="py-4 px-lg-5">
      <div>
        <h1>{dict.submission?.submissions || 'Submissions'}</h1>
      </div>
      <DataTable<SubmissionListItem>
        data={paginatedSubmissions}
        columns={columns}
        loading={loading}
        emptyMessage={dict.submission?.empty || 'No submissions found yet.'}
        loadingMessage={dict.submission?.loading || 'Loading submissions...'}
        keyExtractor={(sub) => sub.id}
        itemName={dict.submission?.submissions || 'submissions'}
        totalItems={submissions.length}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
      />
    </Container>
  );
}
