import { ApiErrorCodes } from '@soba/lib';
import { InternalError } from '../../../src/core/errors';
import type {
  FormEngineAdapter,
  ReadSubmissionsResult,
} from '../../../src/core/integrations/form-engine/FormEngineAdapter';
import { JobFailedError } from '../../../src/core/jobs/settlement';
import {
  bulkAnswerReader,
  engineExportSource,
  type ReadAnswers,
  type SubmissionQuery,
  type SubmissionRecord,
} from '../../../src/features/submission-export/engineSource';
import type { ExportBounds, ExportRow } from '../../../src/features/submission-export/source';

const bounds: ExportBounds = { workspaceId: 'ws1', formId: 'form-1', to: new Date() };

const record = (
  id: string,
  engineSchemaRef: string | null,
  engineSubmissionRef: string | null = `doc-${id}`,
): SubmissionRecord => ({
  submissionId: id,
  confirmationCode: `CODE-${id}`,
  versionId: `version-of-${engineSchemaRef}`,
  submittedAt: '2026-10-01T16:05:00.000Z',
  submitter: 'Sam',
  username: 'sam.sample',
  email: 'sam.sample@example.com',
  engineSchemaRef,
  engineSubmissionRef,
});

const queryOf = (pages: SubmissionRecord[][]): SubmissionQuery => ({
  count: () => Promise.resolve(pages.flat().length),
  async *pages() {
    yield* pages;
  },
});

/** An engine that holds every document except `absent`, and records each read. */
const engine = (absent: string[] = []) => {
  const calls: { formRef: string; refs: string[] }[] = [];
  const read: ReadAnswers = (formRef, refs) => {
    calls.push({ formRef, refs });
    const found = new Map(
      refs
        .filter((ref) => !absent.includes(ref))
        .map((ref): [string, Record<string, unknown>] => [
          ref,
          { form: formRef, state: 'submitted', data: { ref } },
        ]),
    );
    return Promise.resolve({ found, missing: refs.filter((ref) => !found.has(ref)) });
  };
  return { calls, read };
};

const run = async (
  source: ReturnType<typeof engineExportSource>,
  signal = new AbortController().signal,
) => {
  const rows: ExportRow[] = [];
  const unread: number[] = [];
  const options = { pageSize: 100, signal, onUnread: (count: number) => unread.push(count) };
  for await (const row of source.rows(bounds, options)) rows.push(row);
  return { rows, unread };
};

describe('engineExportSource', () => {
  it('reads each engine form of a page once and keeps the query order', async () => {
    const { calls, read } = engine();
    const page = [record('a', 'v1'), record('b', 'v2'), record('c', 'v1')];

    const { rows, unread } = await run(engineExportSource(queryOf([page]), read));

    expect(calls).toEqual([
      { formRef: 'v1', refs: ['doc-a', 'doc-c'] },
      { formRef: 'v2', refs: ['doc-b'] },
    ]);
    expect(rows.map((row) => row.submissionId)).toEqual(['a', 'b', 'c']);
    expect(unread).toEqual([]);
  });

  it('writes the answers under the document data and the submission facts from the query', async () => {
    const { rows } = await run(engineExportSource(queryOf([[record('a', 'v1')]]), engine().read));

    expect(rows).toEqual([
      {
        submissionId: 'a',
        confirmationCode: 'CODE-a',
        versionId: 'version-of-v1',
        submittedAt: '2026-10-01T16:05:00.000Z',
        submitter: 'Sam',
        username: 'sam.sample',
        email: 'sam.sample@example.com',
        answers: { ref: 'doc-a' },
      },
    ]);
  });

  it('counts submissions without a document per page and leaves them out', async () => {
    const { calls, read } = engine(['doc-b']);
    const pages = [
      [record('a', 'v1'), record('b', 'v1'), record('c', 'v1', null)],
      [record('d', null), record('e', 'v1')],
    ];

    const { rows, unread } = await run(engineExportSource(queryOf(pages), read));

    expect(rows.map((row) => row.submissionId)).toEqual(['a', 'e']);
    expect(unread).toEqual([2, 1]);
    expect(calls).toEqual([
      { formRef: 'v1', refs: ['doc-a', 'doc-b'] },
      { formRef: 'v1', refs: ['doc-e'] },
    ]);
  });

  it('counts the submissions of a form the engine no longer has, and keeps the rest', async () => {
    const { read } = engine();
    const readUnlessGone: ReadAnswers = (formRef, refs, signal) =>
      formRef === 'gone'
        ? Promise.reject(
            new InternalError(
              'Form engine document is missing',
              ApiErrorCodes.engine_document_missing,
            ),
          )
        : read(formRef, refs, signal);
    const page = [record('a', 'v2'), record('b', 'gone'), record('c', 'gone')];

    const { rows, unread } = await run(engineExportSource(queryOf([page]), readUnlessGone));

    expect(rows.map((row) => row.submissionId)).toEqual(['a']);
    expect(unread).toEqual([2]);
  });

  it('fails when the engine cannot be read', async () => {
    const read: ReadAnswers = () => Promise.reject(new Error('engine down'));

    const rows = run(engineExportSource(queryOf([[record('a', 'v1')]]), read));

    await expect(rows).rejects.toThrow('engine down');
  });

  it('passes the signal to the engine and stops at the next page once aborted', async () => {
    const controller = new AbortController();
    const signals: AbortSignal[] = [];
    const read: ReadAnswers = (formRef, refs, signal) => {
      signals.push(signal);
      controller.abort('cancel');
      return engine().read(formRef, refs, signal);
    };
    const pages = [[record('a', 'v1')], [record('b', 'v1')]];

    const rows = run(engineExportSource(queryOf(pages), read), controller.signal);

    await expect(rows).rejects.toBe('cancel');
    expect(signals).toEqual([controller.signal]);
  });

  it('counts with the query', async () => {
    const source = engineExportSource(
      queryOf([[record('a', 'v1'), record('b', 'v1')]]),
      engine().read,
    );

    await expect(source.count(bounds)).resolves.toBe(2);
  });

  it('fails the export when the engine has no bulk read', () => {
    const adapter = {} as FormEngineAdapter;

    expect(() => bulkAnswerReader(adapter)).toThrow(JobFailedError);
  });

  /** An adapter whose bulk read needs its own `this`, and records how it was asked. */
  class Adapter {
    readonly calls: unknown[][] = [];
    private readonly result: ReadSubmissionsResult = { found: new Map(), missing: ['x'] };
    readSubmissions(...args: unknown[]) {
      this.calls.push(args);
      return Promise.resolve(this.result);
    }
  }

  it('reads through the engine adapter itself, without whole documents by default', async () => {
    const adapter = new Adapter();
    const signal = new AbortController().signal;
    const read = bulkAnswerReader(adapter as unknown as FormEngineAdapter);

    await expect(read('v1', ['x'], signal)).resolves.toEqual({ found: new Map(), missing: ['x'] });
    expect(adapter.calls).toEqual([['v1', ['x'], signal, {}]]);
  });

  it('asks for whole documents when told to', async () => {
    const adapter = new Adapter();
    const signal = new AbortController().signal;
    const read = bulkAnswerReader(adapter as unknown as FormEngineAdapter, { full: true });

    await read('v1', ['x'], signal);

    expect(adapter.calls).toEqual([['v1', ['x'], signal, { full: true }]]);
  });
});

/** Observe closure independently of generator cleanup semantics. */
const closeableSource = (read: ReadAnswers = engine().read) => {
  let page = 0;
  const next = jest.fn(
    async (): Promise<IteratorResult<SubmissionRecord[]>> =>
      page++ < 2
        ? { done: false, value: [record(String(page), 'v1')] }
        : { done: true, value: undefined },
  );
  const close = jest.fn(
    async (): Promise<IteratorResult<SubmissionRecord[]>> => ({ done: true, value: undefined }),
  );
  const query: SubmissionQuery = {
    count: async () => 2,
    pages: () => ({ [Symbol.asyncIterator]: () => ({ next, return: close }) }),
  };
  const source = engineExportSource(query, read);
  return { source, next, close };
};

describe('export iterator cleanup', () => {
  it('closes the underlying page iterator when the consumer stops early', async () => {
    const { source, next, close } = closeableSource();
    for await (const row of source.rows(bounds, {
      pageSize: 100,
      signal: new AbortController().signal,
      onUnread: jest.fn(),
    })) {
      expect(row.submissionId).toBe('1');
      break;
    }
    expect(next).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the underlying page iterator when explicitly returned', async () => {
    const { source, next, close } = closeableSource();
    const rows = source
      .rows(bounds, { pageSize: 100, signal: new AbortController().signal, onUnread: jest.fn() })
      [Symbol.asyncIterator]();
    await rows.next();
    await rows.return?.();
    await rows.return?.();
    expect(next).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes pages on engine failure and preserves the error', async () => {
    const { source, close } = closeableSource(async () => {
      throw new Error('engine down');
    });
    await expect(run(source)).rejects.toThrow('engine down');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes pages when the database page read fails', async () => {
    const { source, next, close } = closeableSource();
    next.mockRejectedValueOnce(new Error('page query failed'));
    await expect(run(source)).rejects.toThrow('page query failed');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes pages after exhaustion', async () => {
    const { source, next, close } = closeableSource();
    expect((await run(source)).rows).toHaveLength(2);
    expect(next).toHaveBeenCalledTimes(3);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes pages on cancellation without fetching another page', async () => {
    const { source, next, close } = closeableSource();
    const controller = new AbortController();
    const rows = source
      .rows(bounds, { pageSize: 100, signal: controller.signal, onUnread: jest.fn() })
      [Symbol.asyncIterator]();
    await rows.next();
    controller.abort(new Error('client disconnected'));
    await expect(rows.next()).rejects.toThrow('client disconnected');
    expect(next).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
