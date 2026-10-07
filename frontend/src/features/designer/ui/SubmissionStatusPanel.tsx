'use client';

import { useMemo, useState } from 'react';
import { Button, Checkbox, Link, Select } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import type { Column } from '@/src/components/DataTable';
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
  onUpdate: (body: UpdateSubmissionStatusBody) => Promise<void>;
};

/** Current status and assignee of a submission, with the controls to change them. */
export function SubmissionStatusPanel({ review, onUpdate }: Readonly<SubmissionStatusPanelProps>) {
  const dictReview = useDictionary().submission.review;
  const formatLongDate = useFormatLongDate();
  const me = useCurrentUser().displayName;
  const [status, setStatus] = useState<SubmissionReviewStatus | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [emailComment, setEmailComment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const current = review.statusHistory[0];
  const assigning = status === 'ASSIGNED';
  // The signed-in user can always take a submission, listed or not.
  const assignees = me ? [...new Set([...review.assignees, me])] : review.assignees;

  const update = async () => {
    if (!status) return;
    setSaving(true);
    await onUpdate({ status, assignee: assigning ? assignee : null, emailComment });
    setSaving(false);
    setStatus(null);
    setAssignee(null);
    setEmailComment(false);
  };

  const historyColumns: Column<SubmissionStatusChange>[] = useMemo(
    () => [
      {
        key: 'status',
        label: dictReview.status,
        render: (change) => dictReview.statuses[change.status],
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
        <strong>{dictReview.currentStatus}:</strong> {dictReview.statuses[current.status]}
      </div>
      <div className="mb-3" data-testid="submission-status-assignee">
        <strong>{dictReview.assignedTo}:</strong> {current.assignee ?? dictReview.unassigned}
      </div>
      <Select
        label={dictReview.assignOrUpdate}
        placeholder={dictReview.selectPlaceholder}
        value={status}
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
            isDisabled={saving}
            onChange={(key) => setAssignee(key as string)}
            items={assignees.map((id) => ({ id, label: id }))}
            data-testid="submission-status-assignee-select"
          />
          <div className="d-flex justify-content-between align-items-center mt-2">
            <Checkbox
              isSelected={emailComment}
              onChange={setEmailComment}
              isDisabled={saving}
              data-testid="submission-status-email-comment"
            >
              {dictReview.attachComment}
            </Checkbox>
            {me ? (
              <Link onPress={() => setAssignee(me)} data-testid="submission-status-assign-me">
                {dictReview.assignToMe}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="d-flex gap-2 mt-3">
        <Button
          isDisabled={saving || !status || (assigning && !assignee)}
          onPress={() => void update()}
          data-testid="submission-status-update"
        >
          {dictReview.update}
        </Button>
        <Button
          variant="secondary"
          onPress={() => setHistoryOpen(true)}
          data-testid="submission-status-history"
        >
          {dictReview.viewHistory}
        </Button>
      </div>
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
