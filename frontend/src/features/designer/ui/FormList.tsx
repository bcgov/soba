'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Container } from 'react-bootstrap';
import { Button as DSButton, TextField } from '@bcgov/design-system-react-components';
import { DataTable, type Column } from '@/src/components/DataTable';
import { DsPageHeading } from '@/app/ui/DsPageHeading';
import { RowActionButton } from '@/src/components/RowActionButton';
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
      {actions.map((action) => (
        <RowActionButton
          key={action.name}
          data-testid={action.name + '-' + sobaFormId + '-button'}
          onPress={() => {
            if (!sobaFormId) return;
            onAction(action.name, sobaFormId);
          }}
        >
          {action.title}
        </RowActionButton>
      ))}
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
            <RowActionButton
              main
              data-testid={'form-link-' + form.id}
              onPress={() => handleAction('manage', form.id)}
            >
              {form.name || dictForm?.nameLabel || 'Untitled Form'}
            </RowActionButton>
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
    [
      handleAction,
      locale,
      dictFormList,
      dictForm,
      designModeEnabled,
      submitModeEnabled,
      formatLongDate,
    ],
  );

  // Auth gate only — loading (including Keycloak init) is shown inside the table
  // body so the page heading stays visible throughout.
  if (!authenticated && !initializing) {
    return <div className="p-5 text-center">{dict.general.notAuthenticated}</div>;
  }

  return (
    <Container fluid className="py-4 px-lg-5">
      <DsPageHeading id="forms-heading">{dict.general.forms}</DsPageHeading>
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

        <div style={{ width: '300px', maxWidth: '100%' }}>
          <TextField
            aria-label="Search"
            data-testid="search-forms-text"
            value={searchQuery}
            onChange={setSearchQuery}
            iconLeft={<FaMagnifyingGlass />}
            iconRight={
              searchQuery ? (
                <button
                  type="button"
                  data-testid="search-forms-button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'inline-flex',
                  }}
                >
                  <FaX size={12} />
                </button>
              ) : undefined
            }
          />
        </div>
      </div>

      <DataTable<SobaFormSummary>
        data={paginatedForms as SobaFormSummary[]}
        columns={columns}
        loading={loading || initializing}
        error={error}
        emptyMessage="No forms found matching your criteria."
        loadingMessage={dict.general.loading}
        itemName="items"
        caption={dict.general.forms}
        pageSize={pageSize}
        currentPage={currentPage}
        totalItems={filteredForms.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[5, 10, 25, 50]}
        keyExtractor={(form) => form.id}
      />
    </Container>
  );
}

export default FormList;
