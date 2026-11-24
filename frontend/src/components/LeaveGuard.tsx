'use client';

import { useState } from 'react';
import { useDictionary } from '@/app/[lang]/Providers';
import { useLeaveGuard } from '@/src/shared/hooks/useLeaveGuard';
import { ConfirmModal } from './ConfirmModal';

/** While `active`, asks before a link, Back, requestLeave, refresh or close loses unsaved changes. */
export function LeaveGuard({ active }: Readonly<{ active: boolean }>) {
  const t = useDictionary().general.unsavedChanges;
  // The leave waiting on the person's answer.
  const [pending, setPending] = useState<{ go: () => void } | null>(null);
  useLeaveGuard(active, (go) => setPending({ go }));

  const leave = () => {
    setPending(null);
    pending?.go();
  };

  return (
    <ConfirmModal
      show={pending !== null}
      title={t.title}
      message={t.message}
      confirmLabel={t.confirm}
      cancelLabel={t.stay}
      onConfirm={leave}
      onCancel={() => setPending(null)}
      // Escape is not user activation, so the next Back after it could not be held; a click is.
      isDismissable={false}
    />
  );
}
