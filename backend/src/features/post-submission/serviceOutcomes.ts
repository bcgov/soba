import type { Logger } from 'pino';
import { ApiErrorCodes } from '@soba/lib';
import { AppError } from '../../core/errors';
import { upstreamStatusOf } from '../../core/http/httpErrorMapper';
import type {
  PostSubmissionActionRenderOutcome,
  PostSubmissionActionUpload,
} from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import type { DocumentRenderOutcome } from '../document-generation/service';
import type { OpenedFile } from '../files/service';

export const ANSWERS_NOT_READ = "The submission's answers could not be read";
export const UPLOAD_UNAVAILABLE = 'An uploaded file could not be read';

/**
 * Run an engine read for an action. An error is rethrown with a fixed message, so the attempt
 * retries, and logged by class and upstream status only: the engine's message can carry answers.
 */
export const readFromEngine = async <T>(
  read: () => Promise<T>,
  log: Pick<Logger, 'warn'>,
): Promise<T> => {
  try {
    return await read();
  } catch (err) {
    log.warn(
      { error: err instanceof Error ? err.name : 'Error', upstreamStatus: upstreamStatusOf(err) },
      'Submission answers not read',
    );
    throw new Error(ANSWERS_NOT_READ);
  }
};

type RenderStop = Exclude<PostSubmissionActionRenderOutcome['status'], 'ok'>;

/** Statuses a job's render returns besides `ok` and `error`; any other reads as failed. */
const RENDER_STOPS: Partial<Record<DocumentRenderOutcome['status'], RenderStop>> = {
  'template-notfound': 'no-template',
  unavailable: 'unavailable',
  busy: 'busy',
  'template-unavailable': 'failed',
};

/** A render's outcome for an action. An error is `refused` when the render was refused, else `failed`. */
export const toRenderOutcome = (
  outcome: DocumentRenderOutcome,
): PostSubmissionActionRenderOutcome => {
  if (outcome.status === 'ok') {
    return { status: 'ok', data: outcome.data, contentType: outcome.contentType };
  }
  if (outcome.status === 'error') {
    const refused =
      outcome.error instanceof AppError && outcome.error.code === ApiErrorCodes.render_failed;
    return { status: refused ? 'refused' : 'failed' };
  }
  return { status: RENDER_STOPS[outcome.status] ?? 'failed' };
};

/**
 * A submission file lookup for an action: not found reads as missing; a file storage cannot
 * stream throws, so the attempt retries.
 */
export const toUpload = (
  opened: OpenedFile | 'notfound' | 'unavailable',
): PostSubmissionActionUpload | 'missing' => {
  if (opened === 'notfound') return 'missing';
  if (opened === 'unavailable') throw new Error(UPLOAD_UNAVAILABLE);
  const { record, file } = opened;
  if (!file.downloadStream) throw new Error(UPLOAD_UNAVAILABLE);
  return {
    filename: record.filename,
    contentType: record.contentType ?? file.contentType ?? null,
    size: file.size ?? record.size ?? null,
    stream: file.downloadStream,
  };
};
