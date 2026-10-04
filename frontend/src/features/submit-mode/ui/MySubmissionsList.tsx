'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button as DSButton, Select } from '@bcgov/design-system-react-components';
import { usePathname, useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/src/components/DataTable';
import {
  ListPageAuthGate,
  ListPageFilters,
  ListPageToolbar,
} from '@/src/components/ListPageLayout';
import { ListPageSearchField } from '@/src/components/ListPageSearchField';
import { RowActionButton } from '@/src/components/RowActionButton';
import { ConfirmModal } from '@/src/components/ConfirmModal';
import { StatusTag, workflowStateToVariant } from '@/src/components/StatusTag';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { useDictionary } from '@/app/[lang]/Providers';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import { useFormatLongDateTime } from '@/src/shared/hooks/useFormatLongDate';
import { isConflict } from '@/src/shared/api/dataError';
import { useDataErrorNotice } from '@/src/shared/api/useDataErrorNotice';
import { MY_SUBMISSIONS_LIST_QUERY } from '@/src/shared/list/listQueryMemory';
import { useListQuery } from '@/src/shared/list/useListQuery';
import { useDataTable } from '@/src/shared/list/useDataTable';
import {
  useMySubmissionDeleter,
  useMySubmissions,
} from '@/src/features/submit-mode/data/useMySubmissions';
import {
  MY_SUBMISSION_STATES,
  type MySubmissionListItem,
  type MySubmissionState,
} from '@/src/types/submissions';
import styles from './MySubmissionsList.module.css';

const ALL_STATES = 'all';

const toState = (raw: string | undefined): MySubmissionState | undefined =>
  MY_SUBMISSION_STATES.find((state) => state === raw);

const isDraft = (item: MySubmissionListItem) => item.workflowState === 'draft';

// Only an owner deletes, and only before the submission is submitted.
const canDelete = (item: MySubmissionListItem) => isDraft(item) && item.role === 'owner';

// A function replacement keeps `$` in a form name literal.
const fill = (template: string, values: Record<string, string>) =>
  template.replaceAll(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);

/** The caller's own drafts and submitted submissions: continue a draft, view a submission. */
export function MySubmissionsList() {
  const dict = useDictionary();
  const dictMine = dict.mySubmissions;
  const { authenticated, initializing, token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const notifyError = useDataErrorNotice();
  const router = useRouter();
  const locale = getLocaleFromPath(usePathname());
  const formatDateTime = useFormatLongDateTime();

  const listQuery = useListQuery(MY_SUBMISSIONS_LIST_QUERY);
  const rawState = listQuery.filters.state;
  const state = toState(rawState);
  const submissions = useMySubmissions(
    {
      offset: listQuery.offset,
      limit: listQuery.pageSize,
      sort: listQuery.sort,
      q: listQuery.q,
    },
    state,
  );
  const { table } = useDataTable(listQuery, submissions, dictMine.loadError);
  const { remove } = useMySubmissionDeleter();

  const [confirmDelete, setConfirmDelete] = useState<MySubmissionListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { setFilters } = listQuery;
  // A state the API would refuse reads as no filter; drop it so the URL and the Select agree.
  useEffect(() => {
    if (rawState && !state) setFilters({});
  }, [rawState, state, setFilters]);

  const labelValues = useCallback(
    (item: MySubmissionListItem) => ({
      form: item.formName,
      updated: formatDateTime(item.updatedAt),
    }),
    [formatDateTime],
  );

  const openSubmission = useCallback(
    (item: MySubmissionListItem) =>
      router.push(
        isDraft(item) ? `/${locale}/submit/${item.id}` : `/${locale}/submission/${item.id}`,
      ),
    [router, locale],
  );

  const handleDelete = useCallback(() => {
    const item = confirmDelete;
    if (!token || !item) return;
    setDeleting(true);
    remove(token, item.id)
      .then(() => addNotification({ text: dictMine.deleteSuccess, type: 'success' }))
      .catch((cause: unknown) =>
        notifyError(cause, {
          failed: isConflict(cause) ? dictMine.deleteSubmitted : dictMine.deleteError,
        }),
      )
      .finally(() => {
        setDeleting(false);
        setConfirmDelete(null);
      });
  }, [
    token,
    confirmDelete,
    remove,
    addNotification,
    notifyError,
    dictMine.deleteSuccess,
    dictMine.deleteSubmitted,
    dictMine.deleteError,
  ]);

  const handleStateChange = useCallback(
    (key: string | number | null) =>
      setFilters(key && key !== ALL_STATES ? { state: String(key) } : {}),
    [setFilters],
  );

  const stateOptions = useMemo(
    () => [
      { id: ALL_STATES, label: dictMine.allStates },
      ...MY_SUBMISSION_STATES.map((value) => ({ id: value, label: dictMine.states[value] })),
    ],
    [dictMine.allStates, dictMine.states],
  );

  const columns: Column<MySubmissionListItem>[] = useMemo(
    () => [
      {
        key: 'formName',
        label: dictMine.columns.form,
        width: '40%',
        sortField: 'formName',
        render: (item) => (
          <RowActionButton
            main
            data-testid={`my-submission-link-${item.id}`}
            onPress={() => openSubmission(item)}
          >
            {item.formName}
          </RowActionButton>
        ),
      },
      {
        key: 'workflowState',
        label: dictMine.columns.status,
        render: (item) => (
          <StatusTag
            label={dictMine.states[item.workflowState]}
            variant={workflowStateToVariant(item.workflowState)}
            data-testid={`${item.id}-status`}
          />
        ),
      },
      {
        key: 'confirmationCode',
        label: dictMine.columns.confirmationId,
        render: (item) => (
          <span data-testid={`${item.id}-confirmation-id`}>
            {item.confirmationCode ?? (
              <>
                <span aria-hidden="true">—</span>
                <span className="visually-hidden">{dictMine.noCode}</span>
              </>
            )}
          </span>
        ),
      },
      {
        key: 'updatedAt',
        label: dictMine.columns.updatedAt,
        sortField: 'updatedAt',
        sortDefaultDirection: 'desc',
        render: (item) => (
          <span className="small" data-testid={`${item.id}-updated-date`}>
            {formatDateTime(item.updatedAt)}
          </span>
        ),
      },
      {
        key: 'actions',
        label: dictMine.columns.actions,
        align: 'start',
        render: (item) => {
          const draft = isDraft(item);
          const values = labelValues(item);
          return (
            <div className="d-flex gap-2 justify-content-start">
              <RowActionButton
                aria-label={fill(draft ? dictMine.continueLabel : dictMine.viewLabel, values)}
                data-testid={`${item.id}-${draft ? 'continue' : 'view'}`}
                onPress={() => openSubmission(item)}
              >
                {draft ? dictMine.continue : dictMine.view}
              </RowActionButton>
              {canDelete(item) ? (
                <RowActionButton
                  aria-label={fill(dictMine.deleteLabel, values)}
                  data-testid={`${item.id}-delete`}
                  onPress={() => setConfirmDelete(item)}
                >
                  {dictMine.delete}
                </RowActionButton>
              ) : null}
            </div>
          );
        },
      },
    ],
    [dictMine, formatDateTime, labelValues, openSubmission],
  );

  // Loading, including Keycloak init, shows inside the table so the heading stays put.
  if (!authenticated && !initializing) {
    return <ListPageAuthGate>{dict.general.notAuthenticated}</ListPageAuthGate>;
  }

  const filtered = !!listQuery.q || !!state;

  return (
    <>
      <ListPageToolbar>
        <ListPageSearchField
          value={listQuery.searchInput}
          onChange={listQuery.setSearchInput}
          onSubmit={listQuery.commitSearch}
          testIdPrefix="my-submissions"
        />
      </ListPageToolbar>
      <ListPageFilters>
        <Select
          size="medium"
          id="my-submissions-state"
          data-testid="my-submissions-state-select"
          className={styles.stateField}
          label={dictMine.statusFilter}
          selectedKey={state ?? ALL_STATES}
          onSelectionChange={handleStateChange}
          items={stateOptions}
        />
        <DSButton
          variant="secondary"
          data-testid="my-submissions-clear-filters"
          onPress={listQuery.clear}
        >
          {dict.general.clearFilters}
        </DSButton>
      </ListPageFilters>

      <DataTable<MySubmissionListItem>
        {...table}
        loading={table.loading || initializing}
        columns={columns}
        emptyMessage={filtered ? dictMine.noMatches : dictMine.empty}
        loadingMessage={dict.general.loading}
        itemName={dictMine.itemName}
        caption={dict.general.mySubmissions}
        keyExtractor={(item) => item.id}
      />

      <ConfirmModal
        show={confirmDelete !== null}
        title={dictMine.deleteTitle}
        message={confirmDelete ? fill(dictMine.deleteMessage, labelValues(confirmDelete)) : ''}
        confirmLabel={dictMine.delete}
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          // The delete in flight closes the dialog when it settles.
          if (!deleting) setConfirmDelete(null);
        }}
      />
    </>
  );
}
