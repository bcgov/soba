jest.mock('../../../src/core/db/client', () => ({ db: {}, quietDb: {} }));
jest.mock('../../../src/features/notifications/service', () => ({ notificationService: {} }));
const mockIsLive = jest.fn();
jest.mock('../../../src/features/post-submission/repo', () => ({
  SUBMISSION_GONE: 'The submission, its form or its workspace is gone',
  isSubmissionLive: (...args: unknown[]) => mockIsLive(...args),
}));

import type { Logger } from 'pino';
import type { ClaimedJob } from '../../../src/core/db/repos/jobRepo';
import type { JobContext } from '../../../src/core/jobs/registry';
import { JobCancelledError } from '../../../src/core/jobs/settlement';
import { fanOutStatusChanged, reactionJob } from '../../../src/features/submission-review/fanOut';

const CHANGE_ID = '0190f3a2-7c1e-7a4b-9d2e-5f6a7b8c9d0e';
const STATUS_EMAIL = { code: 'submission.status-email', options: { attachComment: true } };

const parent = {
  id: 'parent-job',
  workspaceId: 'ws1',
  formId: 'f1',
  submissionId: 's1',
  revisionId: null,
  createdBy: 'rev-1',
} as ClaimedJob;

const queueChildren = jest.fn();

const fanOut = (actions: unknown[]) =>
  fanOutStatusChanged({
    job: { ...parent, params: { statusChangeId: CHANGE_ID, actions } },
    log: { info: jest.fn() } as unknown as Logger,
    queueChildren,
  } as unknown as JobContext);

beforeEach(() => {
  jest.clearAllMocks();
  mockIsLive.mockResolvedValue(true);
  queueChildren.mockResolvedValue(['child-job']);
});

describe('reactionJob', () => {
  it('is deduped per reaction and change, with the recorded options', () => {
    expect(reactionJob(parent, CHANGE_ID, STATUS_EMAIL, 8)).toEqual({
      type: 'submission.status-email',
      formId: 'f1',
      submissionId: 's1',
      createdBy: 'rev-1',
      params: { statusChangeId: CHANGE_ID, options: { attachComment: true } },
      dedupeKey: `submission.status-email:${CHANGE_ID}`,
      maxAttempts: 8,
    });
  });
});

describe('fanOutStatusChanged', () => {
  it('queues each recorded reaction as a child job', async () => {
    await fanOut([STATUS_EMAIL]);

    expect(queueChildren).toHaveBeenCalledWith([reactionJob(parent, CHANGE_ID, STATUS_EMAIL, 8)]);
  });

  it('reads nothing more for a change that recorded no reactions', async () => {
    await fanOut([]);
    expect(mockIsLive).not.toHaveBeenCalled();
    expect(queueChildren).not.toHaveBeenCalled();
  });

  it('ends cancelled, queuing nothing, once the submission, its form or its workspace is gone', async () => {
    mockIsLive.mockResolvedValue(false);
    await expect(fanOut([STATUS_EMAIL])).rejects.toThrow(
      new JobCancelledError('The submission, its form or its workspace is gone'),
    );
    expect(queueChildren).not.toHaveBeenCalled();
  });
});
