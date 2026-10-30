import sampleData from './sampleData.json';

/** Which submissions an export covers, fixed when it was started. */
export interface ExportBounds {
  workspaceId: string;
  formId: string;
  /** Absent means every version. */
  formVersionId?: string;
  /** Submitted in [from, to). */
  from?: Date;
  to: Date;
}

/** One submission as an export writes it. */
export interface ExportRow {
  submissionId: string;
  confirmationCode: string;
  versionId: string;
  submittedAt: string;
  /** Who submitted it, or `public`. */
  submitter: string;
  /** The answers as the form engine returns them, nested. */
  answers: Record<string, unknown>;
}

export interface ExportRowsOptions {
  pageSize: number;
  signal: AbortSignal;
  /** Called with how many submissions of a page could not be read; they are left out. */
  onUnread: (count: number) => void;
}

/** Where an export's rows come from. */
export interface ExportSource {
  /** How many submissions the bounds cover. */
  count(bounds: ExportBounds): Promise<number>;
  /** The submissions in the bounds, oldest first; stops with the signal's reason once aborted. */
  rows(bounds: ExportBounds, options: ExportRowsOptions): AsyncIterable<ExportRow>;
}

/** Placeholder field list for the export page: the sample fields until it is read from the form. */
export const sampleExportFields = (): string[] => [...sampleData.fields];
