'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useDictionary } from '@/app/[lang]/Providers';
import { useLeaveWarning } from '@/src/shared/hooks/useLeaveWarning';
import { ConfirmModal } from './ConfirmModal';

const HoldContext = createContext<((href: string) => void) | null>(null);

/** Asks before a refresh, close, in-app link, Back or `useGuardedPush` loses unsaved changes. */
export function LeaveGuard({
  active,
  children,
}: Readonly<{ active: boolean; children?: ReactNode }>) {
  const t = useDictionary().general.unsavedChanges;
  const { leaving, leave, stay, hold } = useLeaveWarning(active);

  return (
    <HoldContext.Provider value={hold}>
      {children}
      <ConfirmModal
        show={leaving}
        title={t.title}
        message={t.message}
        confirmLabel={t.confirm}
        cancelLabel={t.stay}
        onConfirm={leave}
        onCancel={stay}
      />
    </HoldContext.Provider>
  );
}

/** `router.push` for a button that leaves the page: inside a LeaveGuard, it asks first. */
export function useGuardedPush() {
  const hold = useContext(HoldContext);
  const router = useRouter();
  return useCallback(
    (href: string) => {
      if (hold) {
        hold(href);
        return;
      }
      router.push(href);
    },
    [hold, router],
  );
}
