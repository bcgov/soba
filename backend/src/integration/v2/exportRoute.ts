import { abortable } from '../middleware/abortable';
import { ApiErrorCodes, hasAllPermissions } from '@soba/lib';
import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { Features } from '../../core/db/codes';
import { isFeatureEnabledCached } from '../../core/db/repos/featureRepo';
import { getWorkspaceIdForForm } from '../../core/db/repos/formRepo';
import { resolveFormPermissions } from '../../core/db/repos/formAccessRepo';
import {
  findActiveApiCredential,
  type CredentialRecord,
} from '../../core/db/repos/workspaceCredentialRepo';
import {
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../../core/errors';
import { exportBounds, exportBoundsOf } from '../../features/submission-export/source';
import { EXPORT_TOO_LARGE } from '../../features/submission-export/sizeLimit';
import { log } from '../../core/logging';
import { integrationExportService } from './exportService';
import { IntegrationExportQuerySchema } from './schema';

const MAX_BYTES = 10 * 1024 * 1024;

const authorizeExport = async (identity: CredentialRecord, formId: string, signal: AbortSignal) => {
  const key = await abortable(signal, () =>
    findActiveApiCredential(identity.issuerCode, identity.clientId!),
  );
  if (key?.id !== identity.id) throw new UnauthorizedError('API credential is not active');
  const workspaceId = await abortable(signal, () => getWorkspaceIdForForm(formId));
  if (!workspaceId || workspaceId !== key.workspaceId || (key.formId && key.formId !== formId)) {
    throw new NotFoundError('Form not found');
  }
  if (
    !key.permissions.includes('submission_read') ||
    !hasAllPermissions(
      await abortable(signal, () => resolveFormPermissions(key.createdBy, workspaceId, formId)),
      ['submission_read'],
    )
  ) {
    throw new ForbiddenError('Submission read access is required for this form');
  }
  // Match designer exports: check availability after authorization, and on every recheck.
  if (
    !(await abortable(signal, () => isFeatureEnabledCached(Features.submission_export, Date.now())))
  ) {
    throw new NotFoundError('Not found', ApiErrorCodes.route_not_found);
  }
  return workspaceId;
};

const bufferExport = async (output: AsyncIterable<string>, signal: AbortSignal) => {
  // Buffer within a fixed bound so failures never produce a successful partial JSON/CSV file.
  const chunks: Buffer[] = [];
  let bytes = 0;
  const content = output[Symbol.asyncIterator]();
  try {
    while (true) {
      // Serialization is sequential; never start another chunk after cancellation.
      // eslint-disable-next-line no-await-in-loop
      const next = await abortable(signal, () => content.next());
      if (next.done) break;
      const chunk = next.value;
      signal.throwIfAborted();
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > MAX_BYTES)
        throw new PayloadTooLargeError('Export exceeds 10 MiB; narrow the date range');
      chunks.push(buffer);
    }
  } finally {
    // Do not hold the HTTP response open waiting for an uncooperative iterator to close.
    if (content.return) void content.return().catch(() => {});
  }
  return Buffer.concat(chunks);
};

export const integrationExportHandler = asyncHandler(async (req, res) => {
  const identity = req.integrationCredential!;
  const formId = req.params.formId;
  const query = IntegrationExportQuerySchema.parse(req.query);
  const disconnected = new AbortController();
  const signal = AbortSignal.any([disconnected.signal, AbortSignal.timeout(60_000)]);
  const onClose = () => disconnected.abort();
  res.on('close', onClose);
  let unread = 0;
  try {
    const authorize = () => authorizeExport(identity, formId, signal);
    const workspaceId = await authorize();
    const bounds = exportBoundsOf(workspaceId, formId, {
      formVersionId: query.formVersionId,
      ...exportBounds(query, new Date()),
    });
    const result = await abortable(signal, () =>
      integrationExportService.open(bounds, {
        format: query.format,
        signal,
        maxBytes: MAX_BYTES,
        authorize: async () => {
          await authorize();
        },
        onUnread: (count) => {
          unread += count;
        },
      }),
    );
    const file = await bufferExport(result.content, signal);
    if (unread)
      throw new ServiceUnavailableError(
        'Some submission documents are unavailable; export not returned',
      );
    await authorize();
    signal.throwIfAborted();
    res.set('Cache-Control', 'no-store');
    res.set(
      'Content-Disposition',
      `attachment; filename="submissions-${formId}.${result.extension}"`,
    );
    res.type(result.contentType).send(file);
    log.info(
      { credentialId: identity.id, workspaceId, formId, format: query.format, bytes: file.length },
      'Integration submission export completed',
    );
  } catch (error) {
    if (disconnected.signal.aborted) return;
    if (error instanceof Error && error.message.startsWith(EXPORT_TOO_LARGE)) {
      throw new PayloadTooLargeError('Export exceeds 10 MiB; narrow the date range');
    }
    if (signal.aborted && !disconnected.signal.aborted) {
      throw new ServiceUnavailableError('Export timed out; narrow the date range');
    }
    throw error;
  } finally {
    res.off('close', onClose);
  }
});
