import { copyFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { Logger } from 'pino';
import type { PostSubmissionEmailPackageOptions } from '@soba/lib';
import {
  JobCancelledError,
  JobDeferredError,
  JobFailedError,
  type PostSubmissionActionContext,
  type PostSubmissionActionRenderOutcome,
} from '../../../src/core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import {
  buildPackage,
  NO_ANSWERS,
  PACKAGE_NOT_STORED,
  PACKAGE_NOT_WRITTEN,
  packageTooLarge,
  RENDER_BUSY_DELAY_MS,
  RENDER_BUSY_SPREAD_MS,
  TEMP_STORAGE_UNAVAILABLE,
} from '../../../src/plugins/post-submission-email-package/build';
import type { PackageSettings } from '../../../src/plugins/post-submission-email-package/settings';
import { openFilesUnder } from './openFiles';
import { readZip } from './readZip';

const MB = 1024 * 1024;
const PDF = Buffer.from('%PDF the rendered answers');
const SETTINGS: PackageSettings = { maxFileMb: 1, maxPackageMb: 100, retentionDays: 7 };

const ID = (n: number) => `0199f6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number, originalName: string) => ({ storage: 'chefs', id: ID(n), originalName });

/** A stored upload: its bytes, and the size storage reports for it (null when it reports none). */
interface StoredUpload {
  filename: string;
  data: Buffer;
  size?: number | null;
  breaks?: boolean;
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'package-build-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const caught = (run: Promise<unknown>): Promise<unknown> => run.catch((err: unknown) => err);

/**
 * A build step's context around in-memory services: answers and uploads as given, temp storage in
 * a scratch folder, and a result that keeps a copy of what it stores.
 */
const harness = (
  setup: {
    answers?: Record<string, unknown> | null;
    uploads?: Record<string, StoredUpload>;
    render?: PostSubmissionActionRenderOutcome;
    ready?: () => Promise<void>;
    maxBytes?: number;
    openError?: Error;
    storeError?: Error;
    reserveError?: Error;
  } = {},
) => {
  let reserved = 0;
  let open = 0;
  let mostOpen = 0;
  const stored: { filename: string; contentType: string; path: string }[] = [];
  const opened = (upload: StoredUpload): Readable => {
    open += 1;
    mostOpen = Math.max(mostOpen, open);
    const stream = upload.breaks
      ? new Readable({
          read() {
            this.push(upload.data.subarray(0, 4));
            this.destroy(new Error('connection reset by the storage service'));
          },
        })
      : Readable.from([upload.data]);
    stream.once('close', () => {
      open -= 1;
    });
    return stream;
  };
  const services = {
    notifications: {
      sendToEach: jest.fn(),
      ready: jest.fn(setup.ready ?? (() => Promise.resolve())),
    },
    tempStorage: {
      reserve: jest.fn((options?: { prefix?: string }) => {
        if (setup.reserveError) throw setup.reserveError;
        reserved += 1;
        return { id: `t${reserved}`, path: join(dir, `${options?.prefix ?? 'tmp'}-${reserved}`) };
      }),
      remove: jest.fn((resource: { path: string }) => rm(resource.path, { force: true })),
    },
    answers: {
      readRevision: jest.fn(() =>
        Promise.resolve(setup.answers === undefined ? {} : setup.answers),
      ),
    },
    documents: {
      render: jest.fn(() =>
        Promise.resolve(
          setup.render ?? {
            status: 'ok' as const,
            data: PDF,
            contentType: 'application/pdf',
            templateFilename: 'permit-report.docx',
          },
        ),
      ),
    },
    files: {
      open: jest.fn((id: string) => {
        if (setup.openError) return Promise.reject(setup.openError);
        const upload = setup.uploads?.[id];
        if (!upload) return Promise.resolve('missing' as const);
        return Promise.resolve({
          filename: upload.filename,
          contentType: null,
          size: upload.size === undefined ? upload.data.length : upload.size,
          stream: opened(upload),
        });
      }),
    },
  };
  const controller = new AbortController();
  const log = { info: jest.fn(), warn: jest.fn() };
  const result = {
    maxBytes: setup.maxBytes ?? 10 * MB,
    store: jest.fn(
      async (staged: { path: string }, meta: { filename: string; contentType: string }) => {
        if (setup.storeError) throw setup.storeError;
        const path = join(dir, `stored-${stored.length + 1}.zip`);
        await copyFile(staged.path, path);
        stored.push({ ...meta, path });
        return { fileId: 'file-1', expiresAt: new Date() };
      },
    ),
  };
  const context = {
    job: {
      id: 'job-1',
      type: 'post-submission-email-package',
      submissionId: 's1',
      revisionId: 'r1',
    },
    previous: null,
    options: { to: ['staff@example.com'] },
    source: { scope: 'form', settingId: 'setting-1', version: 1 },
    submission: {
      id: 's1',
      formId: 'f1',
      formVersionId: 'v1',
      formName: 'Permit Intake',
      workspaceId: 'w1',
      workspaceName: 'Workspace',
      confirmationCode: 'ABC123',
    },
    services,
    result,
    reportProgress: jest.fn(),
    signal: controller.signal,
    log: log as unknown as Logger,
  } as unknown as PostSubmissionActionContext<PostSubmissionEmailPackageOptions>;
  return {
    context,
    services,
    result,
    stored,
    log,
    controller,
    mostOpen: () => mostOpen,
    run: () => buildPackage(SETTINGS)(context),
    /** Nothing is left in temp storage, and nothing there is still held open. */
    expectTempClear: async () => {
      expect((await readdir(dir)).filter((name) => !name.startsWith('stored-'))).toEqual([]);
      expect(await openFilesUnder(dir)).toEqual([]);
    },
  };
};

describe('buildPackage', () => {
  it('stores the document and the uploads, one open at a time, listing those left out', async () => {
    const h = harness({
      answers: {
        documents: [ref(1, 'plan.pdf'), ref(2, 'gone.pdf')],
        grid: [{ photo: [ref(3, 'photo.jpg')] }, { photo: [ref(4, 'plan.pdf')] }],
      },
      uploads: {
        [ID(1)]: { filename: 'plan-0199f6a0.pdf', data: Buffer.from('plan bytes') },
        [ID(3)]: { filename: 'photo-0199f6a1.jpg', data: Buffer.from('photo bytes') },
        [ID(4)]: { filename: 'plan-0199f6a2.pdf', data: Buffer.from('second plan') },
      },
    });

    await h.run();

    expect(h.stored).toEqual([
      expect.objectContaining({
        filename: 'Permit Intake-ABC123.zip',
        contentType: 'application/zip',
      }),
    ]);
    // The document is named after its template; each upload by its original name, numbered.
    const entries = await readZip(h.stored[0].path);
    expect(entries.map(({ name, method }) => [name, method])).toEqual([
      ['permit-report-ABC123.pdf', 0],
      ['attachments/1-plan.pdf', 0],
      ['attachments/2-photo.jpg', 0],
      ['attachments/3-plan.pdf', 0],
      ['missing-files.txt', 0],
    ]);
    expect(entries[0].data).toEqual(PDF);
    expect(entries[3].data.toString()).toBe('second plan');
    expect(entries[4].data.toString()).toContain('gone.pdf: deleted / supprimé');
    expect(h.mostOpen()).toBe(1);
    expect(h.context.reportProgress).toHaveBeenLastCalledWith(5, 5);
    await h.expectTempClear();
  });

  it("names an upload by storage's name only when the answers give it none", async () => {
    const h = harness({
      answers: { files: [ref(1, '')] },
      uploads: { [ID(1)]: { filename: 'scan-0199f6a0.tif', data: Buffer.from('scan bytes') } },
    });

    await h.run();

    const entries = await readZip(h.stored[0].path);
    expect(entries.map((entry) => entry.name)).toEqual([
      'permit-report-ABC123.pdf',
      'attachments/1-scan-0199f6a0.tif',
    ]);
  });

  it('stages an upload whose size storage does not know, removing the copy once it is in', async () => {
    const h = harness({
      answers: { files: [ref(1, 'scan.tif')] },
      uploads: { [ID(1)]: { filename: 'scan.tif', data: Buffer.from('scan bytes'), size: null } },
    });

    await h.run();

    const entries = await readZip(h.stored[0].path);
    expect(entries.map((entry) => entry.name)).toEqual([
      'permit-report-ABC123.pdf',
      'attachments/1-scan.tif',
    ]);
    expect(entries[1].data.toString()).toBe('scan bytes');
    const removedCopy = h.services.tempStorage.remove.mock.invocationCallOrder[0];
    expect(h.services.tempStorage.remove.mock.calls[0][0].path).toContain('package-upload');
    expect(removedCopy).toBeLessThan(h.result.store.mock.invocationCallOrder[0]);
    await h.expectTempClear();
  });

  it('leaves out an upload over the file limit, whether or not storage knows its size', async () => {
    const big = Buffer.alloc(MB + 1);
    const h = harness({
      answers: { files: [ref(1, 'video.mp4'), ref(2, 'raw.bin')] },
      uploads: {
        [ID(1)]: { filename: 'video.mp4', data: big },
        [ID(2)]: { filename: 'raw.bin', data: big, size: null },
      },
    });

    await h.run();

    const entries = await readZip(h.stored[0].path);
    expect(entries.map((entry) => entry.name)).toEqual([
      'permit-report-ABC123.pdf',
      'missing-files.txt',
    ]);
    expect(entries[1].data.toString()).toContain('video.mp4: larger than 1 MB / plus de 1 Mo');
    expect(entries[1].data.toString()).toContain('raw.bin: larger than 1 MB / plus de 1 Mo');
    await h.expectTempClear();
  });

  it('ends dead, storing nothing and holding no file open, when uploads pass the lower limit', async () => {
    const limit = PDF.length + 50;
    const h = harness({
      answers: { files: [ref(1, 'plan.pdf')] },
      uploads: { [ID(1)]: { filename: 'plan.pdf', data: Buffer.alloc(100) } },
      maxBytes: limit,
    });

    const failed = await caught(h.run());

    expect(failed).toBeInstanceOf(JobFailedError);
    expect((failed as Error).message).toBe(packageTooLarge(limit));
    expect(h.stored).toEqual([]);
    await h.expectTempClear();
  });

  it('ends dead before opening the zip when the document alone passes the limit', async () => {
    const h = harness({ maxBytes: PDF.length - 1 });

    const failed = await caught(h.run());

    expect((failed as Error).message).toBe(packageTooLarge(PDF.length - 1));
    await h.expectTempClear();
  });

  it.each([
    ['stops', new JobCancelledError('Notifications are off')],
    ['waits', new JobDeferredError(60_000, 'Daily email limit reached')],
  ])('%s before rendering when no email could be sent', async (_label, error) => {
    const h = harness({ ready: () => Promise.reject(error) });

    await expect(h.run()).rejects.toBe(error);
    expect(h.services.documents.render).not.toHaveBeenCalled();
    expect(h.services.tempStorage.reserve).not.toHaveBeenCalled();
  });

  it('ends dead when the revision has no answers to read', async () => {
    const h = harness({ answers: null });

    const failed = await caught(h.run());

    expect(failed).toBeInstanceOf(JobFailedError);
    expect((failed as Error).message).toBe(NO_ANSWERS);
    expect(h.services.documents.render).not.toHaveBeenCalled();
    await h.expectTempClear();
  });

  it.each([
    ['no-template', JobCancelledError, 'No document template on the form version'],
    ['unavailable', JobCancelledError, 'No document generation for the form'],
    ['busy', JobDeferredError, 'Document generation is busy'],
    ['refused', JobFailedError, 'The template could not be rendered'],
  ] as const)('ends a render that is %s as its table says', async (status, kind, message) => {
    const h = harness({ render: { status } });

    const stopped = await caught(h.run());

    expect(stopped).toBeInstanceOf(kind);
    expect((stopped as Error).message).toBe(message);
    if (stopped instanceof JobDeferredError) {
      expect(stopped.delayMs).toBeGreaterThanOrEqual(RENDER_BUSY_DELAY_MS);
      expect(stopped.delayMs).toBeLessThan(RENDER_BUSY_DELAY_MS + RENDER_BUSY_SPREAD_MS);
    }
    expect(h.stored).toEqual([]);
  });

  it('retries a render that failed', async () => {
    const h = harness({ render: { status: 'failed' } });

    const stopped = await caught(h.run());

    expect(stopped).toBeInstanceOf(Error);
    expect(stopped).not.toBeInstanceOf(JobFailedError);
    expect(stopped).not.toBeInstanceOf(JobCancelledError);
    expect((stopped as Error).message).toBe('The document could not be rendered');
  });

  it('retries with its own message when an upload breaks part way, holding no file open', async () => {
    const h = harness({
      answers: { files: [ref(1, 'plan.pdf')] },
      uploads: {
        [ID(1)]: { filename: 'plan.pdf', data: Buffer.from('plan bytes'), breaks: true },
      },
    });

    const stopped = await caught(h.run());

    expect((stopped as Error).message).toBe(PACKAGE_NOT_WRITTEN);
    expect(h.log.warn).toHaveBeenCalledWith({ error: 'Error' }, 'Package not written');
    expect(h.stored).toEqual([]);
    await h.expectTempClear();
  });

  it('passes on the fixed message a service throws, holding no file open', async () => {
    const h = harness({
      answers: { files: [ref(1, 'plan.pdf')] },
      openError: new Error('An uploaded file could not be read'),
    });

    await expect(h.run()).rejects.toThrow('An uploaded file could not be read');
    await h.expectTempClear();
  });

  it('retries with its own message when temp storage or the store fails, never theirs', async () => {
    const reserving = harness({ reserveError: new Error("EACCES: mkdir '/tmp/secret/path'") });
    await expect(reserving.run()).rejects.toThrow(TEMP_STORAGE_UNAVAILABLE);

    const storing = harness({ storeError: new Error('S3 said: bucket soba-files is read-only') });
    await expect(storing.run()).rejects.toThrow(PACKAGE_NOT_STORED);
    await storing.expectTempClear();
  });

  it("keeps the store's own dead and cancelled outcomes", async () => {
    const over = new JobFailedError('Result over the size limit');
    await expect(harness({ storeError: over }).run()).rejects.toBe(over);
    const stopped = new JobCancelledError('Stop requested');
    await expect(harness({ storeError: stopped }).run()).rejects.toBe(stopped);
  });

  it('stops with the abort reason, leaving nothing in temp storage', async () => {
    const h = harness({
      answers: { files: [ref(1, 'plan.pdf')] },
      uploads: { [ID(1)]: { filename: 'plan.pdf', data: Buffer.from('plan bytes') } },
    });
    h.services.documents.render.mockImplementation(() => {
      h.controller.abort('lease_lost');
      return Promise.resolve({
        status: 'ok',
        data: PDF,
        contentType: 'application/pdf',
        templateFilename: 'permit-report.docx',
      });
    });

    await expect(h.run()).rejects.toBe('lease_lost');
    expect(h.stored).toEqual([]);
    await h.expectTempClear();
  });
});
