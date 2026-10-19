'use client';

import { useMemo, useState } from 'react';
import { Button, Form, Link, Select } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import type { Column } from '@/src/components/DataTable';
import { StatusTag, workflowStateToVariant } from '@/src/components/StatusTag';
import { useFormatLongDate } from '@/src/shared/hooks/useFormatLongDate';
import { useCurrentUser } from '@/src/shared/api/useCurrentUser';
import {
  SUBMISSION_REVIEW_STATUSES,
  type SubmissionReview,
  type SubmissionReviewStatus,
  type SubmissionStatusChange,
  type UpdateSubmissionStatusBody,
} from '@/src/types/submissionReview';
import { SubmissionHistoryModal } from './SubmissionHistoryModal';

type SubmissionStatusPanelProps = {
  review: SubmissionReview;
  /** Resolves true once the change is saved; the controls keep their values otherwise. */
  onUpdate: (body: UpdateSubmissionStatusBody) => Promise<boolean>;
};

function ReviewStatusTag({ status }: Readonly<{ status: SubmissionReviewStatus }>) {
  const dictReview = useDictionary().submission.review;
  return <StatusTag label={dictReview.statuses[status]} variant={workflowStateToVariant(status)} />;
}

/** Current status and assignee of a submission, with the controls to change them. */
export function SubmissionStatusPanel({ review, onUpdate }: Readonly<SubmissionStatusPanelProps>) {
  const dictReview = useDictionary().submission.review;
  const formatLongDate = useFormatLongDate();
  const me = useCurrentUser().displayName;
  const [status, setStatus] = useState<SubmissionReviewStatus | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const current = review.statusHistory[0];
  const assigning = status === 'ASSIGNED';
  // The signed-in user can always take a submission, listed or not.
  const assignees = me ? [...new Set([...review.assignees, me])] : review.assignees;

  const update = async () => {
    if (!status) return;
    setSaving(true);
    const saved = await onUpdate({ status, assignee: assigning ? assignee : null });
    setSaving(false);
    if (!saved) return;
    setStatus(null);
    setAssignee(null);
  };

  const historyColumns: Column<SubmissionStatusChange>[] = useMemo(
    () => [
      {
        key: 'status',
        label: dictReview.status,
        render: (change) => <ReviewStatusTag status={change.status} />,
      },
      {
        key: 'changedAt',
        label: dictReview.dateStatusChanged,
        render: (change) => formatLongDate(change.changedAt),
      },
      { key: 'assignee', label: dictReview.assignee },
      { key: 'updatedBy', label: dictReview.updatedBy },
    ],
    [dictReview, formatLongDate],
  );

  return (
    <div className="d-block w-100">
      <div data-testid="submission-status-current">
        <strong>{dictReview.currentStatus}:</strong> <ReviewStatusTag status={current.status} />
      </div>
      <div className="mb-3" data-testid="submission-status-assignee">
        <strong>{dictReview.assignedTo}:</strong> {current.assignee ?? dictReview.unassigned}
      </div>
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          void update();
        }}
      >
        <Select
          label={dictReview.assignOrUpdate}
          placeholder={dictReview.selectPlaceholder}
          value={status}
          isRequired
          isDisabled={saving}
          onChange={(key) => setStatus(key as SubmissionReviewStatus)}
          items={SUBMISSION_REVIEW_STATUSES.map((id) => ({ id, label: dictReview.statuses[id] }))}
          data-testid="submission-status-select"
        />
        {assigning ? (
          <div className="mt-3">
            <Select
              label={dictReview.assignTo}
              placeholder={dictReview.selectPlaceholder}
              value={assignee}
              isRequired
              isDisabled={saving}
              onChange={(key) => setAssignee(key as string)}
              items={assignees.map((id) => ({ id, label: id }))}
              data-testid="submission-status-assignee-select"
            />
            {me ? (
              <div className="text-end mt-2">
                <Link onPress={() => setAssignee(me)} data-testid="submission-status-assign-me">
                  {dictReview.assignToMe}
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="d-flex gap-2 mt-3">
          <Button
            type="submit"
            isDisabled={saving || !status || (assigning && !assignee)}
            data-testid="submission-status-update"
          >
            {dictReview.update}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onPress={() => setHistoryOpen(true)}
            data-testid="submission-status-history"
          >
            {dictReview.viewHistory}
          </Button>
        </div>
      </Form>
      <SubmissionHistoryModal
        show={historyOpen}
        title={dictReview.statusHistoryTitle}
        columns={historyColumns}
        rows={review.statusHistory}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
