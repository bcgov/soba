'use client';

import { useState } from 'react';
import { Button, TextArea } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { useFormatLongDateTime } from '@/src/shared/hooks/useFormatLongDate';
import type { SubmissionNote } from '@/src/types/submissionReview';

type SubmissionNotesPanelProps = {
  notes: SubmissionNote[];
  onAdd: (text: string) => Promise<void>;
};

/** Staff notes on a submission, newest first, with the box to add one. */
export function SubmissionNotesPanel({ notes, onAdd }: Readonly<SubmissionNotesPanelProps>) {
  const dictReview = useDictionary().submission.review;
  const formatLongDateTime = useFormatLongDateTime();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    setSaving(true);
    await onAdd(text.trim());
    setSaving(false);
    setText('');
  };

  return (
    <div className="d-block w-100">
      <TextArea
        className="bcds-react-aria-TextArea w-100"
        aria-label={dictReview.noteLabel}
        value={text}
        isDisabled={saving}
        onChange={setText}
        data-testid="submission-note-input"
      />
      <div className="mt-3 mb-3">
        <Button
          isDisabled={saving || !text.trim()}
          onPress={() => void add()}
          data-testid="submission-note-add"
        >
          {dictReview.addNote}
        </Button>
      </div>
      {notes.length === 0 ? (
        <p className="text-muted mb-0" data-testid="submission-notes-empty">
          {dictReview.noNotes}
        </p>
      ) : null}
      <div data-testid="submission-notes-list">
        {notes.map((note) => (
          <div key={note.id} className="mb-3" data-testid={`submission-note-${note.id}`}>
            <strong>
              {dictReview.noteByline
                .replace('{author}', note.createdBy)
                .replace('{date}', formatLongDateTime(note.createdAt))}
            </strong>
            <div>{note.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
