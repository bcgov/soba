// Fake transaction: each select answers the next queued result; the submission update is captured.
const mockSelectResults: unknown[][] = [];
const mockSubmissionUpdates: Record<string, unknown>[] = [];

// A query that can be awaited at any step.
const mockChain = (result: unknown): Promise<unknown> & Record<string, () => unknown> => {
  const chain = Promise.resolve(result) as Promise<unknown> & Record<string, () => unknown>;
  for (const method of ['from', 'where', 'limit', 'for', 'values']) chain[method] = () => chain;
  return chain;
};

const mockTx = {
  select: () => mockChain(mockSelectResults.shift()),
  insert: () => mockChain(undefined),
  update: () => ({
    set: (values: Record<string, unknown>) => {
      mockSubmissionUpdates.push(values);
      const chain = mockChain(undefined);
      chain.returning = () => Promise.resolve([{ id: 's1' }]);
      return chain;
    },
  }),
};

jest.mock('../../../../src/core/db/client', () => ({
  db: { transaction: (work: (tx: unknown) => unknown) => work(mockTx) },
}));

import { appendSubmissionRevision } from '../../../../src/core/db/repos/submissionRepo';
import { SubmissionEventType } from '../../../../src/core/db/codes';

const client = { ip: '203.0.113.7', userAgent: 'Mozilla/5.0' };

const input = {
  workspaceId: 'ws1',
  submissionId: 's1',
  revisionId: 'r2',
  parentRevisionId: 'r1',
  actorId: 'u1',
  actorDisplayLabel: 'Sample User',
  status: 'current',
  reason: 'accepted',
  afterEngineSubmissionRef: 'eng-2',
  client,
} as const;

// The row lock, no replay, then the next revision number.
const queueCurrentWrite = () => {
  mockSelectResults.push(
    [{ id: 's1', headRevisionId: 'r1', workflowState: 'draft' }],
    [],
    [{ next: 2 }],
  );
};

/** The update that moves the head (the last one). */
const headUpdate = () => mockSubmissionUpdates.at(-1)!;

describe('appendSubmissionRevision client stamp', () => {
  beforeEach(() => {
    mockSelectResults.length = 0;
    mockSubmissionUpdates.length = 0;
  });

  it('records the IP and user agent with the submit time', async () => {
    queueCurrentWrite();

    await appendSubmissionRevision({
      ...input,
      eventType: SubmissionEventType.submitted,
      workflowState: 'submitted',
    });

    expect(headUpdate()).toMatchObject({
      submittedAt: expect.any(Date),
      submittedIp: client.ip,
      submittedUserAgent: client.userAgent,
    });
  });

  it('records blanks on a submit without a client', async () => {
    queueCurrentWrite();

    await appendSubmissionRevision({
      ...input,
      client: undefined,
      eventType: SubmissionEventType.submitted,
      workflowState: 'submitted',
    });

    expect(headUpdate()).toMatchObject({ submittedIp: null, submittedUserAgent: null });
  });

  it('leaves them alone on a draft save', async () => {
    queueCurrentWrite();

    await appendSubmissionRevision({
      ...input,
      eventType: SubmissionEventType.saved,
      workflowState: 'draft',
    });

    expect(headUpdate()).not.toHaveProperty('submittedIp');
    expect(headUpdate()).not.toHaveProperty('submittedUserAgent');
    expect(headUpdate()).not.toHaveProperty('submittedAt');
  });
});
