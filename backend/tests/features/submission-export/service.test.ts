import type { ExportJobRow } from '../../../src/core/db/repos/submissionExportRepo';
import { ValidationError } from '../../../src/core/errors';
import { EXPORT_ACCESS_LOST } from '../../../src/features/submission-export/job';
import {
  exportBounds,
  exportStatusOf,
  toSubmissionExport,
} from '../../../src/features/submission-export/service';

const created = new Date('2026-10-29T17:00:00Z');
const expiresAt = new Date('2026-11-05T17:00:00Z');

const row = (overrides: Partial<ExportJobRow> = {}): ExportJobRow => ({
  jobId: 'job-1',
  status: 'succeeded',
  progressDone: 5,
  progressTotal: 5,
  resultExpiresAt: expiresAt,
  resultExpired: false,
  resultFileId: 'file-1',
  resultFilename: 'Permit 2026-10-29.csv',
  resultSize: 900,
  resultContentType: 'text/csv',
  resultStoredThisRun: true,
  workspaceId: 'ws1',
  formId: 'form-1',
  params: { format: 'csv', layout: 'singleRowCSVExport', to: '2026-10-29T17:00:00.000Z' },
  createdAt: created,
  finishedAt: created,
  cancelRequestedAt: null,
  lastError: null,
  rowCount: 5,
  unreadCount: 0,
  ...overrides,
});

describe('exportStatusOf', () => {
  it.each(['queued', 'running'] as const)('keeps a %s export as it is', (status) => {
    expect(exportStatusOf(row({ status }))).toEqual({ status });
  });

  it('is ready with its file, and expired once past its expiry', () => {
    expect(exportStatusOf(row())).toEqual({ status: 'ready' });
    expect(exportStatusOf(row({ resultExpired: true, resultFileId: null }))).toEqual({
      status: 'expired',
    });
  });

  it('fails a succeeded export that has no file to show', () => {
    expect(
      exportStatusOf(row({ resultExpiresAt: null, resultFileId: null, resultFilename: null })),
    ).toEqual({ status: 'failed', endReason: 'error' });
  });

  it('says a dead export was too large only when the size limit stopped it', () => {
    expect(
      exportStatusOf(
        row({ status: 'dead', lastError: 'Result over the size limit of 52428800 bytes' }),
      ),
    ).toEqual({ status: 'failed', endReason: 'too_large' });
    expect(
      exportStatusOf(row({ status: 'dead', lastError: 'Timed out after 1800000 ms' })),
    ).toEqual({
      status: 'failed',
      endReason: 'error',
    });
  });

  it('tells a stop apart from lost access and anything else that cancelled it', () => {
    expect(
      exportStatusOf(
        row({ status: 'cancelled', cancelRequestedAt: created, lastError: 'aborted' }),
      ),
    ).toEqual({ status: 'cancelled', endReason: 'cancelled' });
    expect(exportStatusOf(row({ status: 'cancelled', lastError: EXPORT_ACCESS_LOST }))).toEqual({
      status: 'cancelled',
      endReason: 'access_lost',
    });
    expect(
      exportStatusOf(row({ status: 'cancelled', lastError: 'Submission export is turned off' })),
    ).toEqual({ status: 'cancelled', endReason: 'error' });
  });
});

describe('toSubmissionExport', () => {
  it('gives the filters it was started with, its progress, counts and file, and no job error', () => {
    expect(toSubmissionExport(row({ lastError: 'should not leak' }))).toEqual({
      id: 'job-1',
      formId: 'form-1',
      format: 'csv',
      layout: 'singleRowCSVExport',
      to: '2026-10-29T17:00:00.000Z',
      status: 'ready',
      createdAt: created.toISOString(),
      finishedAt: created.toISOString(),
      cancelRequestedAt: null,
      progress: { done: 5, total: 5 },
      unreadCount: 0,
      result: {
        state: 'ready',
        filename: 'Permit 2026-10-29.csv',
        size: 900,
        contentType: 'text/csv',
        expiresAt: expiresAt.toISOString(),
      },
    });
  });

  it('leaves out what a queued export does not have yet', () => {
    const queued = toSubmissionExport(
      row({
        status: 'queued',
        progressDone: null,
        progressTotal: null,
        finishedAt: null,
        resultExpiresAt: null,
        resultFileId: null,
        rowCount: null,
        unreadCount: null,
      }),
    );
    expect(queued).not.toHaveProperty('progress');
    expect(queued).not.toHaveProperty('result');
    expect(queued).not.toHaveProperty('unreadCount');
    expect(queued).not.toHaveProperty('endReason');
  });
});

describe('exportBounds', () => {
  const now = new Date('2026-10-29T20:00:00Z');

  it('ends at now when no end is given or the end is later', () => {
    expect(exportBounds({ format: 'csv' }, now)).toEqual({ to: now.toISOString() });
    expect(exportBounds({ format: 'csv', to: '2026-12-01T00:00:00Z' }, now)).toEqual({
      to: now.toISOString(),
    });
  });

  it('keeps an earlier end and the start as given', () => {
    expect(
      exportBounds(
        { format: 'csv', from: '2026-10-01T07:00:00Z', to: '2026-10-02T07:00:00Z' },
        now,
      ),
    ).toEqual({ from: '2026-10-01T07:00:00.000Z', to: '2026-10-02T07:00:00.000Z' });
  });

  it('refuses a start at or after now', () => {
    expect(() => exportBounds({ format: 'csv', from: '2026-10-30T00:00:00Z' }, now)).toThrow(
      ValidationError,
    );
  });
});
