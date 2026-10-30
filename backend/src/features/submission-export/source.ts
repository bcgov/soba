import { setTimeout as delay } from 'node:timers/promises';
import { env } from '../../core/config/env';
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

const sampleRows = sampleData.rows as ExportRow[];

/** The rows from `index` on, pausing after each; stops with the signal's reason once aborted. */
async function* paced(
  rows: readonly ExportRow[],
  pauseMs: number,
  signal: AbortSignal,
  index = 0,
): AsyncGenerator<ExportRow> {
  if (index >= rows.length) return;
  signal.throwIfAborted();
  yield rows[index];
  if (pauseMs > 0) await delay(pauseMs, undefined, { signal });
  yield* paced(rows, pauseMs, signal, index + 1);
}

/**
 * Placeholder until the submissions query and the form engine read are in: the same sample rows for
 * every form and filter, with an optional pause after each so a running export can be watched.
 */
export const sampleExportSource: ExportSource = {
  count: () => Promise.resolve(sampleRows.length),
  rows: (_bounds, { signal }) => paced(sampleRows, env.getSubmissionExportStubRowDelayMs(), signal),
};

/** Placeholder field list for the export page: the sample fields until it is read from the form. */
export const sampleExportFields = (): string[] => [...sampleData.fields];
