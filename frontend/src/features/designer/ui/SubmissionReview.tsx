'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { FormType, Submission } from '@formio/react';
import {
  Accordion,
  AccordionGroup,
  Button,
  InlineAlert,
} from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { usePageNotices } from '@/src/components/PageHeader';
import { ConfirmModal } from '@/src/components/ConfirmModal';
import type { Column } from '@/src/components/DataTable';
import { WorkflowStateBadge } from '@/src/features/submissions/ui/WorkflowStateBadge';
import { ReadOnlyFormView } from '@/src/features/formio-v5/ui/ReadOnlyFormView';
import { submissionDeleteMessage } from '@/src/features/submissions/submissionDeleteMessage';
import { useSubmissionDeleter } from '@/src/features/designer/data/useFormSubmissions';
import { useSubmissionReview } from '@/src/features/designer/data/useSubmissionReview';
import type { SubmissionEdit } from '@/src/types/submissionReview';
import { useFormatLongDate, useFormatLongDateTime } from '@/src/shared/hooks/useFormatLongDate';
import { useAuthErrorDefaults } from '@/src/shared/api/useDataErrorNotice';
import { LoadErrorAlert } from '@/src/shared/ui/LoadErrorAlert';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import type { SubmissionDataDocument } from '@/src/types/forms';
import type { SubmissionListItem } from '@/src/types/submissions';
import { SubmissionHistoryModal } from './SubmissionHistoryModal';
import { SubmissionNotesPanel } from './SubmissionNotesPanel';
import { SubmissionStatusPanel } from './SubmissionStatusPanel';

const PANELS = ['submission-review-status', 'submission-review-notes', 'submission-review-data'];

type SubmissionReviewProps = {
  submission: SubmissionListItem;
  schema: FormType | null;
  /** null = no engine document (no saved answers); `{}` data = empty answers on a real document. */
  content: SubmissionDataDocument | null;
};

function MetaLine({
  label,
  value,
  testId,
}: Readonly<{ label: string; value: string; testId: string }>) {
  return (
    <div data-testid={testId}>
      <strong>{label}:</strong> {value}
    </div>
  );
}

/** Staff review of one submission: its details, status, notes and answers. */
export function SubmissionReview({ submission, schema, content }: Readonly<SubmissionReviewProps>) {
  const dict = useDictionary();
  const dictSub = dict.submission;
  const dictReview = dictSub.review;
  const router = useRouter();
  const locale = getLocaleFromPath(usePathname());
  const formatLongDate = useFormatLongDate();
  const formatLongDateTime = useFormatLongDateTime();
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const authDefaults = useAuthErrorDefaults();
  const submissionDeleter = useSubmissionDeleter();
  const { review, updateStatus, addNote, saveData } = useSubmissionReview(submission.id);
  const [open, setOpen] = useState<'delete' | 'confirmChange' | 'dataHistory' | null>(null);
  const [pending, setPending] = useState(false);

  usePageNotices([
    { id: 'submission-review-sample', variant: 'info', body: dictReview.stubNotice },
  ]);

  // Runs a write and reports how it went. Resolves whether it was saved, so a panel keeps what was
  // typed when it was not.
  const run = async (write: (token: string) => Promise<void>, done: string, failed: string) => {
    if (!token) {
      addNotification({ text: dict.general.sessionExpired, type: 'error' });
      return false;
    }
    setPending(true);
    try {
      await write(token);
      addNotification({ text: done, type: 'success' });
      return true;
    } catch (e: unknown) {
      addNotification({ text: failed, type: 'error', consoleError: e });
      return false;
    } finally {
      setPending(false);
      setOpen(null);
    }
  };

  const remove = () =>
    run(
      async (current) => {
        await submissionDeleter.remove(current, submission.id);
        router.push(`/${locale}/build/${submission.formId}?tab=submissions`);
      },
      dictSub.deleteSuccess,
      dictSub.deleteFailure,
    );

  const editColumns: Column<SubmissionEdit>[] = useMemo(
    () => [
      { key: 'editedBy', label: dictReview.username },
      {
        key: 'editedAt',
        label: dictReview.date,
        render: (edit) => formatLongDateTime(edit.editedAt),
      },
    ],
    [dictReview, formatLongDateTime],
  );

  const lastEdit = review.data?.editHistory[0];
  const submitter = submission.createdBy || dictSub.anon;

  return (
    <>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div data-testid="submission-view-header">
          <WorkflowStateBadge
            state={submission.workflowState}
            data-testid="submission-view-status"
          />
          {submission.submittedAt ? (
            <MetaLine
              label={dictReview.submitted}
              value={formatLongDateTime(submission.submittedAt)}
              testId="submission-view-submitted"
            />
          ) : null}
          {submission.confirmationCode ? (
            <MetaLine
              label={dictSub.confirmationId}
              value={submission.confirmationCode}
              testId="submission-view-confirmation"
            />
          ) : null}
          <MetaLine
            label={dictReview.submittedBy}
            value={submitter}
            testId="submission-view-submitter"
          />
          <MetaLine
            label={dictReview.modified}
            value={formatLongDateTime(lastEdit?.editedAt ?? submission.updatedAt)}
            testId="submission-view-modified"
          />
          <MetaLine
            label={dictReview.modifiedBy}
            value={lastEdit?.editedBy ?? submitter}
            testId="submission-view-modified-by"
          />
        </div>
        <Button
          variant="secondary"
          size="small"
          danger
          onPress={() => setOpen('delete')}
          data-testid="submission-review-delete"
        >
          {dictSub.delete}
        </Button>
      </div>

      {review.error ? (
        <LoadErrorAlert
          error={review.error}
          messages={{ ...authDefaults, failed: dictReview.loadError }}
          testIds={{ failed: 'submission-review-loaderror' }}
        />
      ) : null}
      {review.isLoading ? <CenteredProgress label={dict.general.loading} /> : null}

      {/* The answers are already loaded, so they show whatever happens to the review read. */}
      <AccordionGroup allowsMultipleExpanded defaultExpandedKeys={PANELS}>
        {review.data ? (
          <>
            <Accordion
              id={PANELS[0]}
              data-testid={`accordion-${PANELS[0]}`}
              label={dictReview.status}
            >
              <SubmissionStatusPanel
                review={review.data}
                onUpdate={(body) =>
                  run(
                    (current) => updateStatus(current, body),
                    dictReview.statusUpdated,
                    dictReview.saveFailure,
                  )
                }
              />
            </Accordion>
            <Accordion
              id={PANELS[1]}
              data-testid={`accordion-${PANELS[1]}`}
              label={dictReview.notes}
            >
              <SubmissionNotesPanel
                notes={review.data.notes}
                onAdd={(text) =>
                  run(
                    (current) => addNote(current, text),
                    dictReview.noteAdded,
                    dictReview.saveFailure,
                  )
                }
              />
            </Accordion>
          </>
        ) : null}
        <Accordion
          id={PANELS[2]}
          data-testid={`accordion-${PANELS[2]}`}
          label={dictReview.submissionHeading}
        >
          <div className="d-block w-100">
            <div className="text-end" data-testid="submission-view-version">
              {dict.general.version}: {submission.versionNo ?? 1}
            </div>
            {schema && content !== null ? (
              <ReadOnlyFormView
                schema={schema}
                submission={{ data: (content.data ?? {}) as Submission['data'] }}
                testId="submission-view-form"
              />
            ) : (
              <InlineAlert variant="info" role="status" data-testid="submission-view-nocontent">
                {dictSub.noContent}
              </InlineAlert>
            )}
            {/* Only a submitted submission has submitted data to change, and a review to record it. */}
            {submission.submittedAt && review.data ? (
              <div className="d-flex gap-2 mt-3">
                <Button
                  isDisabled={pending}
                  onPress={() => setOpen('confirmChange')}
                  data-testid="submission-data-update"
                >
                  {dictReview.update}
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => setOpen('dataHistory')}
                  data-testid="submission-data-history"
                >
                  {dictReview.viewHistory}
                </Button>
              </div>
            ) : null}
          </div>
        </Accordion>
      </AccordionGroup>

      <ConfirmModal
        show={open === 'delete'}
        title={dictSub.deleteTitle}
        message={submissionDeleteMessage(dictSub, submission, formatLongDate)}
        confirmLabel={dictSub.delete}
        onConfirm={() => void remove()}
        onCancel={() => setOpen(null)}
        pending={pending}
      />
      <ConfirmModal
        show={open === 'confirmChange'}
        title={dictReview.confirmChangeTitle}
        message={dictReview.confirmChangeMessage}
        confirmLabel={dictReview.submit}
        onConfirm={() => void run(saveData, dictReview.dataUpdated, dictReview.saveFailure)}
        onCancel={() => setOpen(null)}
        pending={pending}
      />
      <SubmissionHistoryModal
        show={open === 'dataHistory'}
        title={dictReview.dataHistoryTitle}
        intro={dictReview.dataHistoryIntro}
        columns={editColumns}
        rows={review.data?.editHistory ?? []}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
