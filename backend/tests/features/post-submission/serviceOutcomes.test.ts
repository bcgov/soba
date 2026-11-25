import { Readable } from 'node:stream';
import type { FileRecord } from '../../../src/core/db/repos/fileRepo';
import {
  ServiceUnavailableError,
  UnprocessableEntityError,
  ValidationError,
} from '../../../src/core/errors';
import { HttpClientError } from '../../../src/core/http/httpClient';
import { httpErrorToAppError } from '../../../src/core/http/httpErrorMapper';
import type { RevisionRenderOutcome } from '../../../src/features/document-generation/service';
import { toRenderError } from '../../../src/features/document-generation/renderError';
import {
  ANSWERS_NOT_READ,
  readFromEngine,
  toRenderOutcome,
  toUpload,
  UPLOAD_UNAVAILABLE,
} from '../../../src/features/post-submission/serviceOutcomes';
import { FormioApiError } from '../../../src/plugins/formio-v5/formioV5Client';

describe('readFromEngine', () => {
  it('returns what the read returns', async () => {
    const warn = jest.fn();
    await expect(
      readFromEngine(() => Promise.resolve({ data: { name: 'Pat' } }), { warn }),
    ).resolves.toEqual({
      data: { name: 'Pat' },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("throws a fixed message and logs only the error's class, never the engine's text", async () => {
    const warn = jest.fn();
    const engineError = new FormioApiError(
      400,
      '{"message":"invalid","details":[{"value":"123 456 789"}]}',
      'http://formio.test/form/f1/submission/s1',
    );
    await expect(readFromEngine(() => Promise.reject(engineError), { warn })).rejects.toThrow(
      new Error(ANSWERS_NOT_READ),
    );
    expect(warn).toHaveBeenCalledWith(
      { error: 'FormioApiError', upstreamStatus: undefined },
      'Submission answers not read',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('123 456 789');
  });
});

const context = { code: 'cdogs-v3', templateId: 'tpl-1' };
const renderError = (err: unknown): RevisionRenderOutcome => ({
  status: 'error',
  code: 'cdogs-v3',
  error: toRenderError(err, context),
});

describe('toRenderOutcome', () => {
  it("passes on the document, its content type and the template's name", () => {
    const data = Buffer.from('%PDF-1.7');
    expect(
      toRenderOutcome({
        status: 'ok',
        code: 'cdogs-v3',
        data,
        contentType: 'application/pdf',
        templateName: 'Permit report',
      }),
    ).toEqual({
      status: 'ok',
      data,
      contentType: 'application/pdf',
      templateName: 'Permit report',
    });
  });

  it.each([
    ['template-notfound', 'no-template'],
    ['unavailable', 'unavailable'],
    ['busy', 'busy'],
    ['template-unavailable', 'failed'],
  ] as const)('reads %s as %s', (status, expected) => {
    expect(toRenderOutcome({ status })).toEqual({ status: expected });
  });

  it.each([
    ['a refused template', new ValidationError('CDOGS error 400: bad tag')],
    ['an unconvertible document', new UnprocessableEntityError('CDOGS error 422: cannot convert')],
    [
      'a request too large',
      httpErrorToAppError(new HttpClientError(413, 'Too Large', '', 'http://cdogs.test'), 'CDOGS'),
    ],
  ])('reads %s as refused', (_case, err) => {
    expect(toRenderOutcome(renderError(err))).toEqual({ status: 'refused' });
  });

  it.each([
    ['a backend failure', new ServiceUnavailableError('CDOGS error 500')],
    [
      'a rate limit',
      httpErrorToAppError(new HttpClientError(429, 'Too Many', '', 'http://cdogs.test'), 'CDOGS'),
    ],
    ['a config error', new Error('PLUGIN_CDOGS_V3_TOKEN_URL is required')],
  ])('reads %s as failed', (_case, err) => {
    expect(toRenderOutcome(renderError(err))).toEqual({ status: 'failed' });
  });

  it.each(['notfound', 'denied', 'no-content', 'infected', 'scan-unavailable'] as const)(
    'reads %s, which a job render does not return, as failed',
    (status) => {
      expect(toRenderOutcome({ status })).toEqual({ status: 'failed' });
    },
  );
});

describe('toUpload', () => {
  const record = {
    id: 'file-1',
    workspaceId: 'w1',
    profile: 'default',
    backendRef: 'ref-1',
    filename: 'site plan.pdf',
    contentType: 'application/pdf',
    size: 2048,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    createdBy: 'user-1',
    updatedBy: 'user-1',
  } satisfies FileRecord;
  const stored = (overrides: { size?: number; contentType?: string } = {}) => ({
    engineFileRef: 'ref-1',
    filename: 'ref-1',
    downloadStream: Readable.from(['bytes']),
    ...overrides,
  });

  it('takes the name and type from the file row and the size from storage', () => {
    const file = stored({ size: 2050, contentType: 'application/octet-stream' });
    expect(toUpload({ record, file })).toEqual({
      filename: 'site plan.pdf',
      contentType: 'application/pdf',
      size: 2050,
      stream: file.downloadStream,
    });
  });

  it("falls back to storage's type and the row's size, else null", () => {
    expect(
      toUpload({
        record: { ...record, contentType: null },
        file: stored({ contentType: 'text/plain' }),
      }),
    ).toMatchObject({ contentType: 'text/plain', size: 2048 });
    expect(
      toUpload({ record: { ...record, contentType: null, size: null }, file: stored() }),
    ).toMatchObject({ contentType: null, size: null });
  });

  it('reads notfound as missing', () => {
    expect(toUpload('notfound')).toBe('missing');
  });

  it('throws a fixed message when storage cannot serve the file', () => {
    expect(() => toUpload('unavailable')).toThrow(UPLOAD_UNAVAILABLE);
    const noStream = { engineFileRef: 'ref-1', filename: 'ref-1', publicUrl: 'https://s3.test/x' };
    expect(() => toUpload({ record, file: noStream })).toThrow(UPLOAD_UNAVAILABLE);
  });
});
