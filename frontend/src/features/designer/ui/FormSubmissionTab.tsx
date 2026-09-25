'use client';
import { useMemo, useState, useCallback } from 'react';
import { FaRegTrashCan, FaFile } from 'react-icons/fa6';
import { Link, Button } from '@bcgov/design-system-react-components';
import { useRouter, usePathname } from 'next/navigation';

import type { Dictionary } from '@/src/types/dictionary';
import { DataTable, type Column } from '@/src/components/DataTable';
import { Modal } from '@/src/components/Modal';
import { useFormatLongDate } from '@/src/shared/hooks/useFormatLongDate';
import type { SubmissionListItem } from '@/src/types/submissions';
import { Tag } from '@/src/components/Tag';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import {
  useFormSubmissions,
  useSubmissionDeleter,
} from '@/src/features/designer/data/useFormSubmissions';
import { FORM_SUBMISSIONS_LIST_QUERY } from '@/src/shared/list/listQueryMemory';
import { useListQuery } from '@/src/shared/list/useListQuery';
import { useDataTable } from '@/src/shared/list/useDataTable';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import {
  capitalizeFirstLetter,
  convertSubmissionIdToConfirmationId,
} from '@/src/shared/util/stringUtils';

interface FormSubmissionTabProps {
  dict: Dictionary;
  formId?: string;
  /** True once the tab has been opened; the read waits for that. See useFormSubmissions. */
  opened: boolean;
}

export default function FormSubmissionTab({
  dict,
  formId,
  opened,
}: Readonly<FormSubmissionTabProps>) {
  const query = useListQuery(FORM_SUBMISSIONS_LIST_QUERY);
  const submissionsResult = useFormSubmissions(formId, opened, {
    offset: query.offset,
    limit: query.pageSize,
    sort: query.sort,
    q: query.q,
  });
  const { table } = useDataTable(query, submissionsResult, dict.submission.error);
  const submissionDeleter = useSubmissionDeleter();
  const formatLongDate = useFormatLongDate();
  const { token } = useKeycloak();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deleteId, setDeleteId] = useState<string>('');
  const { addNotification } = useNotificationStore();

  const deletePress = useCallback((submissionId: string) => {
    setShowDeleteConfirm(true);
    setDeleteId(submissionId);
  }, []);

  const confirmDelete = useCallback(async () => {
    setShowDeleteConfirm(false);
    try {
      await submissionDeleter.remove(token as string, deleteId);
      addNotification({
        text: dict.submission.deleteSuccess || 'Submission deleted successfully',
        type: 'success',
      });
    } catch (e: unknown) {
      addNotification({
        text: e instanceof Error && e.message ? e.message : dict.submission.deleteFailure,
        type: 'error',
        consoleError: e,
      });
    }
  }, [token, deleteId, submissionDeleter, addNotification, dict]);

  const columns: Column<SubmissionListItem>[] = useMemo(
    () => [
      {
        key: 'id',
        label: dict.submission?.confirmationId || 'Confirmation Id',
        render: (sub) => (
          <span data-testid={`${sub.id}-confirmation-id`}>
            {convertSubmissionIdToConfirmationId(sub.id)}
          </span>
        ),
      },
      {
        key: 'versionNo',
        label: dict.general?.version || 'Version',
        render: (sub) => `v${sub.versionNo || '?'}`,
      },
      {
        key: 'createdBy',
        label: dict.submission?.submitter || 'Submitter',
        render: (sub) => sub.createdBy || dict.submission.anon,
      },
      {
        key: 'workflowState',
        label: dict.form?.status || 'Status',
        render: (sub) => (
          <Tag
            data-testid={`${sub.id}-status-tag`}
            text={capitalizeFirstLetter(sub.workflowState)}
            color={sub.workflowState === 'submitted' ? 'green' : 'grey'}
          />
        ),
      },
      {
        key: 'submittedAt',
        label: dict.submission?.submittedAt || 'Submission Date',
        sortField: 'submittedAt',
        render: (sub) => (
          <span className="small" data-testid={`${sub.id}-submitted-date`}>
            {sub.submittedAt ? formatLongDate(sub.submittedAt) : 'N/A'}
          </span>
        ),
      },
      {
        key: 'actions',
        label: dict.submission?.actions || 'Actions',
        render: (sub) => (
          <>
            <Link
              className="bcds-react-aria-Link medium false me-2"
              aria-label={dict.submission.view}
              data-testid={`${sub.id}-view-link`}
              onPress={() => router.push(`/${locale}/build/${sub.formId}/submissions/${sub.id}`)}
            >
              <FaFile />
            </Link>
            <Link
              className="bcds-react-aria-Link medium false danger"
              data-testid={`${sub.id}-delete-link`}
              aria-label={dict.submission.delete}
              onPress={() => {
                deletePress(sub.id);
              }}
            >
              <FaRegTrashCan />
            </Link>
          </>
        ),
      },
    ],
    [dict, formatLongDate, deletePress, locale, router],
  );

  return (
    <>
      <DataTable<SubmissionListItem>
        {...table}
        columns={columns}
        emptyMessage={dict.submission.emptyList}
        loadingMessage={dict.general.loading}
        itemName="submissions"
        caption={dict.submission?.submissions || 'Submissions'}
        keyExtractor={(sub) => sub.id}
      />
      <Modal
        show={showDeleteConfirm}
        title={`${dict.submission.deleteConfirm || 'Confirm Delete'}`}
        onClose={() => setShowDeleteConfirm(false)}
        size="sm"
      >
        <p className="text-center px-2 py-3 text-muted">
          {dict.submission.deleteConfirmText}: {deleteId}
        </p>
        <div>
          <Button
            variant="secondary"
            data-testid="cancel-delete-button"
            className="bcds-react-aria-Button medium secondary me-2"
            aria-label={dict.workspaces.cancel}
            isIconButton
            onPress={() => {
              setShowDeleteConfirm(false);
            }}
          >
            {dict.workspaces.cancel}
          </Button>
          <Button
            variant="secondary"
            data-testid="confirm-delete-button"
            aria-label={dict.submission.confirm}
            isIconButton
            danger
            onPress={() => {
              confirmDelete();
            }}
          >
            {dict.submission.confirm}
          </Button>
        </div>
      </Modal>
    </>
  );
}
