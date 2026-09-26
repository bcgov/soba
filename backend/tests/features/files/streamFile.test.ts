import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import express, { type NextFunction, type Request, type Response } from 'express';
import { asyncHandler } from '../../../src/core/api/shared/asyncHandler';
import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';
import { log } from '../../../src/core/logging';
import { streamFile } from '../../../src/features/files/streamFile';

interface Served {
  port: number;
  /** Errors that reached the error chain. */
  seen: unknown[];
  close: () => Promise<void>;
}

/** Mounted like the files route: an async handler, then the core error handler. */
async function serve(source: Readable): Promise<Served> {
  const seen: unknown[] = [];
  const app = express();
  app.get(
    '/file',
    asyncHandler(async (_req, res) => {
      res.setHeader('Content-Type', 'text/plain');
      await streamFile(source, res, 'file-1');
    }),
  );
  app.use((err: unknown, _req: Request, _res: Response, next: NextFunction) => {
    seen.push(err);
    next(err);
  });
  app.use(coreErrorHandler);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    port: (server.address() as AddressInfo).port,
    seen,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** GET the file; `complete` is false when the connection closed before the body finished. */
function download(
  port: number,
  onFirstData?: () => void,
): Promise<{ body: string; complete: boolean }> {
  return new Promise((resolve) => {
    const req = http.get({ port, path: '/file' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        if (!body) onFirstData?.();
        body += chunk;
      });
      res.on('error', () => undefined);
      res.on('close', () => resolve({ body, complete: res.complete }));
    });
    req.on('error', () => resolve({ body: '', complete: false }));
  });
}

const storageFailure = () => new Error('storage failed');

function expectLoggedStorageFailure(logError: jest.SpyInstance): void {
  expect(logError).toHaveBeenCalledTimes(1);
  expect(logError).toHaveBeenCalledWith(
    expect.objectContaining({
      fileId: 'file-1',
      err: expect.objectContaining({ message: 'storage failed' }),
    }),
    'File download failed',
  );
}

describe('streamFile', () => {
  let served: Served | undefined;

  afterEach(async () => {
    await served?.close();
    served = undefined;
    jest.restoreAllMocks();
  });

  it('streams the whole file', async () => {
    served = await serve(Readable.from(['ab', 'c']));
    await expect(download(served.port)).resolves.toEqual({ body: 'abc', complete: true });
    expect(served.seen).toEqual([]);
  });

  it('logs a storage error after the first bytes and cuts the response', async () => {
    const logError = jest.spyOn(log, 'error').mockImplementation(() => undefined);
    const source = new Readable({ read() {} });
    source.push('partial');
    served = await serve(source);
    // Fail only once the client holds the first bytes, so headers and data were sent.
    const result = await download(served.port, () => source.destroy(storageFailure()));
    expect(result).toEqual({ body: 'partial', complete: false });
    expectLoggedStorageFailure(logError);
    expect(served.seen).toEqual([]);
  });

  it('logs a storage error before any bytes and cuts the response', async () => {
    const logError = jest.spyOn(log, 'error').mockImplementation(() => undefined);
    const source = new Readable({
      read() {
        this.destroy(storageFailure());
      },
    });
    served = await serve(source);
    await expect(download(served.port)).resolves.toEqual({ body: '', complete: false });
    expectLoggedStorageFailure(logError);
    expect(served.seen).toEqual([]);
  });

  it('destroys the source when the client disconnects, and logs it at info', async () => {
    const logInfo = jest.spyOn(log, 'info').mockImplementation(() => undefined);
    const source = new Readable({
      read() {
        this.push('x'.repeat(16 * 1024));
      },
    });
    const sourceClosed = new Promise((resolve) => source.once('close', resolve));
    served = await serve(source);
    const { port } = served;
    await new Promise<void>((resolve) => {
      const req = http.get({ port, path: '/file' }, (res) => {
        res.once('data', () => {
          req.destroy();
          resolve();
        });
      });
      req.on('error', () => undefined);
    });
    await sourceClosed;
    expect(source.destroyed).toBe(true);
    await new Promise((resolve) => setImmediate(resolve));
    expect(logInfo).toHaveBeenCalledWith(
      { fileId: 'file-1' },
      'File download closed by the client',
    );
    expect(served.seen).toEqual([]);
  });
});
