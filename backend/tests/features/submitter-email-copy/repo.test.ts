const mockTransaction = jest.fn();
const mockFindWhere = jest.fn();
let mockFound: unknown[] = [];
jest.mock('../../../src/core/db/client', () => ({
  db: {
    transaction: (...args: unknown[]) => mockTransaction(...args),
    select: () => ({
      from: () => ({
        where: (where: unknown) => {
          mockFindWhere(where);
          return { limit: () => Promise.resolve(mockFound) };
        },
      }),
    }),
  },
}));
const mockInsertJob = jest.fn();
jest.mock('../../../src/core/db/repos/jobRepo', () => ({
  insertJob: (...args: unknown[]) => mockInsertJob(...args),
}));

import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import {
  findEmailCopyRequest,
  queueEmailCopy,
  recentEmailCopies,
} from '../../../src/features/submitter-email-copy/repo';

const copy = {
  workspaceId: 'ws1',
  formId: 'f1',
  submissionId: 's1',
  address: 'pat@example.com',
  requestedBy: 'u1',
  idpCode: 'public',
  maxAttempts: 8,
};
const T = '"soba"."submitter_email_copy_request"';
const LAST_HOUR = `${T}."created_at" >= now() - interval '1 hour'`;

const render = (scope: Parameters<typeof recentEmailCopies>[0]) => {
  const where = recentEmailCopies(scope, copy);
  return where ? new PgDialect().sqlToQuery(where) : undefined;
};

// Every request in the last hour counts, whatever became of it; copies have a budget of their own.
describe('recentEmailCopies', () => {
  it.each([
    ['submission', `${T}."submission_id" = $1`, 's1'],
    ['recipient', `${T}."address" = $1`, 'pat@example.com'],
    ['form', `${T}."form_id" = $1`, 'f1'],
    ['workspace', `${T}."workspace_id" = $1`, 'ws1'],
  ] as const)("counts the last hour's requests for the %s", (scope, where, param) => {
    expect(render(scope)).toMatchObject({ sql: `(${LAST_HOUR} and ${where})`, params: [param] });
  });

  it('counts every request in the last hour for the environment', () => {
    expect(render('environment')).toMatchObject({ sql: LAST_HOUR, params: [] });
  });
});

describe('queueEmailCopy', () => {
  const limits = { submission: 5, recipient: 10, form: 500, workspace: 2000, environment: 5000 };
  // What each scope has counted in the last hour, in EMAIL_COPY_SCOPES order.
  const counted = (totals: number[]) => totals.map((total) => [{ total }]);

  let steps: string[];
  let inserted: unknown[];

  /** A transaction that records its steps and answers the counts in order. */
  const transaction = (totals: number[]) => {
    const answers = counted(totals);
    const tx = {
      execute: jest.fn(() => {
        steps.push('lock');
        return Promise.resolve();
      }),
      select: () => ({
        from: () => ({
          where: () => {
            steps.push('count');
            return Promise.resolve(answers.shift());
          },
        }),
      }),
      insert: () => ({
        values: (values: unknown) => {
          steps.push('insert request');
          inserted.push(values);
          return { returning: () => Promise.resolve([{ id: 'req-1' }]) };
        },
      }),
    };
    mockTransaction.mockImplementation((run: (t: typeof tx) => unknown) => run(tx));
  };

  beforeEach(() => {
    jest.resetAllMocks();
    steps = [];
    inserted = [];
    mockInsertJob.mockImplementation(() => {
      steps.push('queue job');
      return Promise.resolve('job-1');
    });
  });

  // Requests at once wait on the lock, so a burst cannot all count zero before any is saved.
  it('takes the lock, counts every scope, then saves the request and queues its job', async () => {
    transaction([4, 9, 499, 1999, 4999]);
    await expect(queueEmailCopy(copy, limits)).resolves.toEqual({ jobId: 'job-1' });
    expect(steps).toEqual([
      'lock',
      'count',
      'count',
      'count',
      'count',
      'count',
      'insert request',
      'queue job',
    ]);
    expect(inserted).toEqual([
      {
        workspaceId: 'ws1',
        formId: 'f1',
        submissionId: 's1',
        address: 'pat@example.com',
        requestedBy: 'u1',
        idpCode: 'public',
      },
    ]);
  });

  // The address stays in the request; the job names it only by id.
  it('queues the job with the request id and a dedupe key for it', async () => {
    transaction([0, 0, 0, 0, 0]);
    await queueEmailCopy(copy, limits);
    expect(mockInsertJob).toHaveBeenCalledWith(expect.anything(), {
      type: 'submission.email-copy',
      workspaceId: 'ws1',
      formId: 'f1',
      submissionId: 's1',
      createdBy: 'u1',
      params: { requestId: 'req-1' },
      dedupeKey: 'submission.email-copy:req-1',
      maxAttempts: 8,
    });
  });

  it.each([
    ['submission', [5, 0, 0, 0, 0]],
    ['recipient', [0, 10, 0, 0, 0]],
    ['form', [0, 0, 500, 0, 0]],
    ['workspace', [0, 0, 0, 2000, 0]],
    ['environment', [0, 0, 0, 0, 5000]],
  ])('names the %s limit and saves nothing once it is reached', async (scope, totals) => {
    transaction(totals);
    await expect(queueEmailCopy(copy, limits)).resolves.toEqual({ limit: scope });
    expect(inserted).toEqual([]);
    expect(mockInsertJob).not.toHaveBeenCalled();
  });

  // Thrown inside the transaction, so the request is rolled back with it.
  it('throws when the job is not queued', async () => {
    transaction([0, 0, 0, 0, 0]);
    mockInsertJob.mockResolvedValue(null);
    await expect(queueEmailCopy(copy, limits)).rejects.toThrow('Email copy job not queued');
  });
});

// Matched on the submission too, so a job can only send a request made for its own submission.
describe('findEmailCopyRequest', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockFound = [];
  });

  it("reads the request by its id and the job's submission", async () => {
    mockFound = [{ id: 'req-1' }];
    await expect(findEmailCopyRequest('req-1', 's1')).resolves.toEqual({ id: 'req-1' });
    const where = mockFindWhere.mock.calls[0][0] as SQL;
    expect(new PgDialect().sqlToQuery(where)).toMatchObject({
      sql: `(${T}."id" = $1 and ${T}."submission_id" = $2)`,
      params: ['req-1', 's1'],
    });
  });

  it('answers null when there is no such request for the submission', async () => {
    await expect(findEmailCopyRequest('req-1', 's2')).resolves.toBeNull();
  });
});
