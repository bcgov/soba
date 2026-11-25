import { PassThrough } from 'node:stream';

// The service's three reads and writes go to the database; these stand-ins answer for them, and the
// rest of the service runs as it is.
const mockIsPackageJobOf = jest.fn();
const mockInsertPackageAudit = jest.fn();
const mockOpenJobResult = jest.fn();

jest.mock('../../../src/core/db/client', () => ({ db: {}, quietDb: {} }));
jest.mock('../../../src/core/db/repos/submissionPackageRepo', () => ({
  isPackageJobOf: (...args: unknown[]) => mockIsPackageJobOf(...args),
  insertPackageAudit: (...args: unknown[]) => mockInsertPackageAudit(...args),
}));
jest.mock('../../../src/core/jobs/outputs', () => ({
  openJobResult: (...args: unknown[]) => mockOpenJobResult(...args),
}));

import { ApiErrorCodes } from '@soba/lib';
import { SubmissionPackageAuditAction } from '../../../src/core/db/codes';
import { NotFoundError, ServiceUnavailableError } from '../../../src/core/errors';
import { submissionPackageService } from '../../../src/features/submission-package/service';

const ctx = { actorId: 'reader', workspaceId: 'ws1', formId: 'f1', submissionId: 's1' };
const JOB = 'job-1';

const ready = () => {
  const stream = new PassThrough();
  return {
    stream,
    opened: {
      state: 'ready' as const,
      file: { id: 'file-1', size: 436, filename: 'Permit-ABC123.zip' },
      content: { downloadStream: stream },
    },
  };
};

const refusal = (err: unknown) => {
  expect(err).toBeInstanceOf(NotFoundError);
  expect(err).toMatchObject({ statusCode: 404, code: ApiErrorCodes.file_not_found });
};

describe('submissionPackageService.openDownload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsertPackageAudit.mockResolvedValue(undefined);
  });

  it("refuses a job that is not this submission's package build without opening anything", async () => {
    mockIsPackageJobOf.mockResolvedValue(false);

    refusal(await submissionPackageService.openDownload(ctx, JOB).catch((err: unknown) => err));
    expect(mockIsPackageJobOf).toHaveBeenCalledWith('ws1', 's1', JOB);
    expect(mockOpenJobResult).not.toHaveBeenCalled();
    expect(mockInsertPackageAudit).not.toHaveBeenCalled();
  });

  it.each([
    ['has expired', 'expired'],
    ['is gone', 'none'],
  ])('refuses a package that %s, recording no download', async (_how, state) => {
    mockIsPackageJobOf.mockResolvedValue(true);
    mockOpenJobResult.mockResolvedValue({ state });

    refusal(await submissionPackageService.openDownload(ctx, JOB).catch((err: unknown) => err));
    expect(mockInsertPackageAudit).not.toHaveBeenCalled();
  });

  it('records the download before it hands the package over', async () => {
    const { opened } = ready();
    mockIsPackageJobOf.mockResolvedValue(true);
    mockOpenJobResult.mockResolvedValue(opened);
    let recorded: () => void = () => undefined;
    mockInsertPackageAudit.mockReturnValue(
      new Promise<void>((resolve) => {
        recorded = resolve;
      }),
    );

    let handed = false;
    const download = submissionPackageService.openDownload(ctx, JOB).then((result) => {
      handed = true;
      return result;
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(handed).toBe(false);

    recorded();
    await expect(download).resolves.toBe(opened);
    expect(mockInsertPackageAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workspaceId: 'ws1',
        formId: 'f1',
        submissionId: 's1',
        jobId: JOB,
        fileId: 'file-1',
        action: SubmissionPackageAuditAction.downloaded,
        size: 436,
        actorId: 'reader',
      }),
    );
  });

  it('closes the package and answers 503 when the download cannot be recorded', async () => {
    const { stream, opened } = ready();
    mockIsPackageJobOf.mockResolvedValue(true);
    mockOpenJobResult.mockResolvedValue(opened);
    mockInsertPackageAudit.mockRejectedValue(new Error('audit insert failed'));

    const err = await submissionPackageService.openDownload(ctx, JOB).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableError);
    expect(err).toMatchObject({ statusCode: 503 });
    expect(stream.destroyed).toBe(true);
  });
});
