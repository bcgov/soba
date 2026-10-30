'use client';

import type { FormType, Submission } from '@formio/react';
import { Button, InlineAlert } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { EditableFormView } from '@/src/features/formio-v5/ui/EditableFormView';
import { ReadOnlyFormView } from '@/src/features/formio-v5/ui/ReadOnlyFormView';

type SubmissionAnswersPanelProps = {
  schema: FormType | null;
  /** The answers on screen; null when the submission has no answer document. */
  answers: Submission | null;
  versionNo: number;
  /** Whether the answers are being edited. */
  editing: boolean;
  /** Whether a write is in flight, which holds the edit buttons. */
  pending: boolean;
  /** Whether the caller may change the answers. */
  canEdit: boolean;
  /** Whether the submission has submitted answers, and so a history of changes to them. */
  hasHistory: boolean;
  onEdit: () => void;
  onDataChange: (data: Record<string, unknown>) => void;
  onUpdate: () => void;
  onCancel: () => void;
  onHistory: () => void;
};

/** A submission's answers, read only or edited by staff, with the buttons for both. */
export function SubmissionAnswersPanel({
  schema,
  answers,
  versionNo,
  editing,
  pending,
  canEdit,
  hasHistory,
  onEdit,
  onDataChange,
  onUpdate,
  onCancel,
  onHistory,
}: Readonly<SubmissionAnswersPanelProps>) {
  const dict = useDictionary();
  const dictReview = dict.submission.review;

  if (!schema || !answers) {
    return (
      <div className="d-block w-100">
        <div className="text-end" data-testid="submission-view-version">
          {dict.general.version}: {versionNo}
        </div>
        <InlineAlert variant="info" role="status" data-testid="submission-view-nocontent">
          {dict.submission.noContent}
        </InlineAlert>
      </div>
    );
  }

  return (
    <div className="d-block w-100">
      <div className="text-end" data-testid="submission-view-version">
        {dict.general.version}: {versionNo}
      </div>
      {editing ? (
        <>
          <InlineAlert
            variant="info"
            role="status"
            title={dictReview.editingNotice}
            data-testid="submission-edit-notice"
          />
          <EditableFormView
            schema={schema}
            submission={answers}
            onDataChange={onDataChange}
            testId="submission-edit-form"
          />
          <div className="d-flex gap-2 mt-3 d-print-none">
            <Button isDisabled={pending} onPress={onUpdate} data-testid="submission-edit-update">
              {dictReview.update}
            </Button>
            <Button
              variant="secondary"
              isDisabled={pending}
              onPress={onCancel}
              data-testid="submission-edit-cancel"
            >
              {dictReview.cancelEdit}
            </Button>
          </div>
        </>
      ) : (
        <>
          <ReadOnlyFormView schema={schema} submission={answers} testId="submission-view-form" />
          {hasHistory ? (
            <div className="d-flex gap-2 mt-3 d-print-none">
              {canEdit ? (
                <Button onPress={onEdit} data-testid="submission-edit">
                  {dictReview.editData}
                </Button>
              ) : null}
              <Button variant="secondary" onPress={onHistory} data-testid="submission-data-history">
                {dictReview.viewHistory}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
