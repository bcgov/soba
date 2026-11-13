import { PrintStatus, type PrintStatusCode } from '@/src/types/templates';

/** The word that marks a print of answers not submitted; null for submitted ones. */
export const printMarkOf = (
  status: PrintStatusCode,
  labels: Readonly<{ unsavedMark: string; draftMark: string }>,
): string | null =>
  ({
    [PrintStatus.unsaved]: labels.unsavedMark,
    [PrintStatus.draft]: labels.draftMark,
    [PrintStatus.submitted]: null,
  })[status];
