'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Container, Form, InputGroup, Button } from 'react-bootstrap';
import { Button as DSButton, ProgressCircle } from '@bcgov/design-system-react-components';
import { DataTable, type Column } from '@/src/components/DataTable';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import { useRouter, usePathname } from 'next/navigation';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import { FaMagnifyingGlass, FaX } from 'react-icons/fa6';
import { getSobaForms } from '@/src/shared/api/sobaApi';
import type { SobaFormSummary } from '@/src/shared/api/sobaApiForms';
import { useFormatLongDate } from '@/src/shared/hooks/useFormatLongDate';
import { useAppSelector } from '@/lib/store';

const CustomActionButtons = ({
  form,
  onAction,
  designModeEnabled,
  submitModeEnabled,
}: {
  form: SobaFormSummary;
  onAction: (name: string, id: string) => void;
  designModeEnabled?: boolean;
  submitModeEnabled?: boolean;
}) => {
  // All actions (manage/submit/submissions) are keyed on the SOBA formId.
  const sobaFormId = form.id;

  const actions = [];
  if (designModeEnabled) actions.push({ name: 'manage', title: 'Manage' });
  if (submitModeEnabled) {
    actions.push({ name: 'submit', title: 'Submit' });
    actions.push({ name: 'submissions', title: 'Submissions' });
  }

  return (
    <div className="d-flex gap-2 justify-content-start">
      {actions.map((action) => {
        return (
          <button
            key={action.name}
            type="button"
            data-test-id={action.name + '-' + sobaFormId + '-button'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!sobaFormId) return;
              onAction(action.name, sobaFormId);
            }}
            className="btn btn-link p-0 m-0"
            style={{ textDecoration: 'underline', color: '#00538A' }}
            title={action.title}
          >
            <div className="position-relative d-inline-flex align-items-center justify-content-center">
              {action.title}
            </div>
          </button>
        );
      })}
    </div>
  );
};

function FormList({
  designModeEnabled = true,
  submitModeEnabled = true,
}: {
  designModeEnabled?: boolean;
  submitModeEnabled?: boolean;
}) {
  const dict = useDictionary();
  const dictFormList = dict.submission?.formList;
  const dictForm = dict.form;
  const { authenticated, token, initializing } = useKeycloak();

  const router = useRouter();
  const pathname = usePathname();

  const [forms, setForms] = useState<SobaFormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const locale = getLocaleFromPath(pathname);

  const { activeWorkspaceId } = useAppSelector((state) => state.workspace);

  useEffect(() => {
    if (authenticated && token && activeWorkspaceId) {
      let isMounted = true;
      const loadForms = async () => {
        setLoading(true);
        try {
          const data = await getSobaForms(token as string, activeWorkspaceId);
          if (isMounted) {
            setForms(Array.isArray(data.items) ? data.items : []);
          }
        } catch (err: unknown) {
          console.error('Error fetching forms:', err);
          if (isMounted && err && typeof err === 'object' && 'message' in err) {
            setError((err as { message: string }).message);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };
      loadForms();
      return () => {
        isMounted = false;
      };
    }
  }, [authenticated, token, activeWorkspaceId]);

  const filteredForms = useMemo(() => {
    if (!searchQuery.trim()) return forms;
    const query = searchQuery.toLowerCase();
    return forms.filter(
      (f) =>
        (f.name || '').toLowerCase().includes(query) ||
        (f.slug || '').toLowerCase().includes(query),
    );
  }, [forms, searchQuery]);

  // Removed unused totalPages
  const paginatedForms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredForms.slice(start, start + pageSize);
  }, [filteredForms, currentPage, pageSize]);

  useEffect(() => {
    const setP = () => {
      setCurrentPage(1);
    };
    setP();
  }, [searchQuery, pageSize]);

  const handleAction = useCallback(
    (name: string, id: string) => {
      if (name === 'manage') {
        router.push(`/${locale}/designer/${id}`);
      } else if (name === 'submit') {
        router.push(`/${locale}/form/${id}`);
      } else if (name === 'submissions') {
        router.push(`/${locale}/submissions/${id}`);
      }
    },
    [router, locale],
  );

  const formatLongDate = useFormatLongDate();

  const columns: Column<SobaFormSummary>[] = useMemo(
    () => [
      {
        key: 'name',
        label: dictFormList?.columns?.name || dictForm?.nameLabel || 'Form Name',
        width: '40%',
        render: (form: SobaFormSummary) => {
          return designModeEnabled ? (
            <a
              href="#"
              data-testid={'form-link-' + form.id}
              onClick={(e) => {
                e.preventDefault();
                handleAction('manage', form.id);
              }}
              className="text-decoration-underline"
              style={{ cursor: 'pointer', color: '#00538A' }}
            >
              {form.name || dictForm?.nameLabel || 'Untitled Form'}
            </a>
          ) : (
            <span>{form.name || dictForm?.nameLabel || 'Untitled Form'}</span>
          );
        },
      },
      {
        key: 'actions',
        label: dictFormList?.columns?.actions || 'Actions',
        align: 'start',
        render: (form: SobaFormSummary) => (
          <CustomActionButtons
            form={form}
            onAction={handleAction}
            designModeEnabled={designModeEnabled}
            submitModeEnabled={submitModeEnabled}
          />
        ),
      },
      {
        key: 'created',
        label: dictFormList?.columns?.createdBy || 'Created By',
        render: (form: SobaFormSummary) => {
          if (!form.createdBy) return <span className="text-muted small">—</span>;
          return <span className="small">{form.createdBy}</span>;
        },
      },
      {
        key: 'updated',
        label: dictFormList?.columns?.createdAt || 'Created Date',
        render: (form: SobaFormSummary) => (
          <span className="small">{formatLongDate(form.createdAt)}</span>
        ),
      },
    ],
    [handleAction, dictFormList, dictForm, designModeEnabled, submitModeEnabled, formatLongDate],
  );

  if (initializing)
    return (
      <div className="p-5 text-center">
        <ProgressCircle isIndeterminate aria-label={dict.general.loading} />
      </div>
    );
  if (!authenticated) return <div className="p-5 text-center">{dict.general.notAuthenticated}</div>;

  return (
    <Container fluid className="py-4 px-lg-5">
      <div>
        <h1>Forms</h1>
      </div>
      <div className="mb-3 d-flex justify-content-between align-items-center">
        {designModeEnabled && (
          <DSButton
            variant="primary"
            data-testid="create-form-button"
            onPress={() => router.push(`/${locale}/designer`)}
          >
            Create
          </DSButton>
        )}

        <InputGroup style={{ maxWidth: '300px' }}>
          <Form.Control
            placeholder="Search"
            data-testid="search-forms-text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-end-0"
          />
          {searchQuery && (
            <Button
              variant="outline-secondary"
              data-testid="search-forms-button"
              className="border-start-0 border-end-0 bg-white"
              onClick={() => setSearchQuery('')}
              style={{ borderColor: '#dee2e6' }}
            >
              <FaX size={12} />
            </Button>
          )}
          <InputGroup.Text className="bg-white" style={{ cursor: 'pointer' }}>
            <FaMagnifyingGlass className="text-muted" />
          </InputGroup.Text>
        </InputGroup>
      </div>

      <DataTable<SobaFormSummary>
        data={paginatedForms as SobaFormSummary[]}
        columns={columns}
        loading={loading}
        error={error}
        emptyMessage="No forms found matching your criteria."
        loadingMessage={dict.general.loading}
        itemName="items"
        pageSize={pageSize}
        currentPage={currentPage}
        totalItems={filteredForms.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[5, 10, 25, 50]}
        keyExtractor={(form) => form.id}
      />

      <style jsx global>{`
        .hover\:text-primary:hover {
          color: var(--bs-primary) !important;
        }
        .table-hover tbody tr:hover {
          background-color: rgba(0, 123, 255, 0.03) !important;
        }
      `}</style>
    </Container>
  );
}

export default FormList;
