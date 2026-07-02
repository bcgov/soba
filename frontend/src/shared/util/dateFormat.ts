/** Format an ISO date string as a long date, e.g. "May 25, 2026". Returns '' for empty input. */
export function formatLongDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateStr));
}
