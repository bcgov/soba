import { ApiErrorCodes } from '@soba/lib';
import { ValidationError } from '../../core/errors';

/** The submitted-in bounds: `to` no later than now, so a retry exports the same submissions. */
export const exportBounds = (
  body: { from?: string; to?: string },
  now: Date,
): { from?: string; to: string } => {
  const requestedTo = body.to ? new Date(body.to) : now;
  const to = requestedTo < now ? requestedTo : now;
  if (body.from && new Date(body.from) >= to) {
    throw new ValidationError(
      'from must be before to, and before now',
      ApiErrorCodes.request_invalid,
    );
  }
  return {
    ...(body.from ? { from: new Date(body.from).toISOString() } : {}),
    to: to.toISOString(),
  };
};

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

/** The bounds of the form's submissions that the filters cover, from their ISO times. */
export const exportBoundsOf = (
  workspaceId: string,
  formId: string,
  filters: { formVersionId?: string; from?: string; to: string },
): ExportBounds => ({
  workspaceId,
  formId,
  formVersionId: filters.formVersionId,
  from: filters.from ? new Date(filters.from) : undefined,
  to: new Date(filters.to),
});

/** A form version's schema, with the version it belongs to. */
export interface ExportSchema {
  versionId: string;
  schema: Record<string, unknown>;
}

/** One submission as an export writes it. */
export interface ExportRow {
  submissionId: string;
  confirmationCode: string;
  versionId: string;
  submittedAt: string;
  /** Who submitted it, or `public`. */
  submitter: string;
  username: string;
  email: string;
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
