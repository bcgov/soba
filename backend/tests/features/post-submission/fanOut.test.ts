import type { Logger } from 'pino';
import { JobCancelledError } from '../../../src/core/jobs/errors';
import type { JobFacts } from '../../../src/core/jobs/facts';
import type { JobContext } from '../../../src/core/jobs/registry';
import { getJobSettings } from '../../../src/core/jobs/settings';
import {
  childAttempts,
  childJob,
  fanOutSubmitted,
} from '../../../src/features/post-submission/fanOut';
import type { SubmittedAction } from '../../../src/features/post-submission/resolve';

jest.mock('../../../src/core/db/client', () => ({ db: {}, quietDb: {} }));
const mockIsLive = jest.fn();
jest.mock('../../../src/features/post-submission/repo', () => ({
  ...jest.requireActual('../../../src/features/post-submission/repo'),
  isSubmissionLive: (...args: unknown[]) => mockIsLive(...args),
}));

// This pod has post-submission-a installed; it lacks every other plugin.
jest.mock(
  '../../../src/core/integrations/post-submission-action/PostSubmissionActionRegistry',
  () => ({
    findInstalledPostSubmissionAction: (code: string) =>
      code === 'post-submission-a' ? { job: { maxAttempts: 5 } } : undefined,
  }),
);

const action = (code: string): SubmittedAction => ({
  code,
  options: { to: ['a@example.com'] },
  source: { scope: 'form', settingId: `${code}-setting`, version: 3 },
});

const parent = {
  id: 'parent-job',
  workspaceId: 'ws1',
  formId: 'f1',
  submissionId: 's1',
  revisionId: 'r9',
  createdBy: 'actor-1',
} as JobFacts;

describe('childJob', () => {
  it('is deduped per action and revision, with the recorded options', () => {
    expect(childJob(parent, action('post-submission-a'), 5)).toEqual({
      type: 'post-submission-a',
      formId: 'f1',
      submissionId: 's1',
      revisionId: 'r9',
      actionConfigId: 'post-submission-a-setting',
      createdBy: 'actor-1',
      params: {
        options: { to: ['a@example.com'] },
        source: { scope: 'form', settingId: 'post-submission-a-setting', version: 3 },
      },
      dedupeKey: 'post-submission-a:r9',
      maxAttempts: 5,
    });
  });
});

describe('childAttempts', () => {
  it("takes the plugin's attempts when this pod has it", () => {
    expect(childAttempts('post-submission-a')).toBe(5);
  });

  it('takes JOB_MAX_ATTEMPTS for an action whose plugin this pod lacks', () => {
    expect(childAttempts('post-submission-newer')).toBe(getJobSettings().maxAttempts);
  });
});

describe('fanOutSubmitted', () => {
  const queueOnSuccess = jest.fn();
  const fanOut = (actions: SubmittedAction[]) =>
    fanOutSubmitted({
      job: { ...parent, params: { actions } },
      log: { info: jest.fn() } as unknown as Logger,
      queueOnSuccess,
    } as unknown as JobContext);

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLive.mockResolvedValue(true);
  });

  it("queues each recorded action as a child job, with its plugin's attempts", async () => {
    await fanOut([action('post-submission-a'), action('post-submission-newer')]);

    expect(queueOnSuccess).toHaveBeenCalledWith([
      childJob(parent, action('post-submission-a'), 5),
      childJob(parent, action('post-submission-newer'), getJobSettings().maxAttempts),
    ]);
  });

  it('reads nothing more for a submission that recorded no actions', async () => {
    await fanOut([]);
    expect(mockIsLive).not.toHaveBeenCalled();
    expect(queueOnSuccess).not.toHaveBeenCalled();
  });

  it('ends cancelled, queuing nothing, once the submission, its form or its workspace is gone', async () => {
    mockIsLive.mockResolvedValue(false);

    await expect(fanOut([action('post-submission-a')])).rejects.toThrow(
      new JobCancelledError('The submission, its form or its workspace is gone'),
    );
    expect(queueOnSuccess).not.toHaveBeenCalled();
  });
});
