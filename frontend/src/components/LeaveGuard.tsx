'use client';

import { useDictionary } from '@/app/[lang]/Providers';
import { useLeaveWarning } from '@/src/shared/hooks/useLeaveWarning';
import { ConfirmModal } from './ConfirmModal';

/** Asks before a refresh, close, in-app link or Back loses unsaved changes. */
export function LeaveGuard({ active }: Readonly<{ active: boolean }>) {
  const t = useDictionary().general.unsavedChanges;
  const { leaving, leave, stay } = useLeaveWarning(active);

  return (
    <ConfirmModal
      show={leaving}
      title={t.title}
      message={t.message}
      confirmLabel={t.confirm}
      cancelLabel={t.stay}
      onConfirm={leave}
      onCancel={stay}
    />
  );
}
