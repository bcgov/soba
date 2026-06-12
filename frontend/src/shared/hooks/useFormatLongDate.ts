'use client';

import { useCallback } from 'react';
import { useLocale } from 'react-aria-components';

/**
 * Returns a long-date formatter, e.g. "May 25, 2026" (en) / "25 mai 2026" (fr).
 *
 * Locale comes from the nearest React Aria `<I18nProvider>` (wired in the
 * `[lang]` layout), so dates follow the active app locale instead of a
 * hardcoded one. Empty or invalid input returns ''.
 *
 * The returned function is stable across renders (memoized on locale), so it is
 * safe to use as a `useMemo`/`useCallback` dependency.
 */
export function useFormatLongDate() {
  const { locale } = useLocale();
  return useCallback(
    (dateStr?: string | null): string => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat(locale, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    },
    [locale],
  );
}
