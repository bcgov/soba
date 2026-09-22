'use client';

import { useCallback } from 'react';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { useDictionary } from '@/app/[lang]/Providers';
import { classifyDataError, messageForDataError, type DataErrorMessages } from './dataError';

/** The messages a caller must name; the two auth kinds default to the shared dictionary strings. */
export type DataErrorNoticeMessages = Omit<DataErrorMessages, 'sessionExpired' | 'forbidden'> &
  Partial<Pick<DataErrorMessages, 'sessionExpired' | 'forbidden'>>;

/**
 * Reports a failed read or write as an error notification, routing the original error to the
 * console sink. Session and access failures fall back to the shared dictionary strings.
 */
export function useDataErrorNotice() {
  const { addNotification } = useNotificationStore();
  const dict = useDictionary();

  return useCallback(
    (error: unknown, messages: DataErrorNoticeMessages) => {
      const text = messageForDataError(classifyDataError(error), {
        sessionExpired: dict.general.sessionExpired,
        forbidden: dict.general.noAccess,
        ...messages,
      });
      addNotification({ text, type: 'error', consoleError: error });
    },
    [addNotification, dict],
  );
}
