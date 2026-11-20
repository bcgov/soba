import type { JobOutputRow } from '../../../src/core/db/repos/jobOutputRepo';
import { JobCancelledError } from '../../../src/core/jobs/errors';
import type { JobFacts } from '../../../src/core/jobs/facts';
import {
  cancelReason,
  pluginJob,
  previousStep,
  type ActionRunFacts,
} from '../../../src/features/post-submission/actionStep';

jest.mock('../../../src/core/db/client', () => ({ db: {}, quietDb: {} }));

const ready: ActionRunFacts = {
  postSubmissionAvailable: true,
  enabledHere: true,
  featureAvailable: true,
  live: true,
  stillEnabled: true,
};

describe('cancelReason', () => {
  it('runs the action when every check passes', () => {
    expect(cancelReason(ready)).toBeNull();
  });

  it.each([
    ['postSubmissionAvailable', 'Post-submission is not available for the form'],
    ['enabledHere', 'The action is not enabled in this environment'],
    ['featureAvailable', "The action's feature is not available for the form"],
    ['live', 'The submission, its form or its workspace is gone'],
    ['stillEnabled', 'The action was turned off'],
  ] as const)('cancels when %s fails', (fact, reason) => {
    expect(cancelReason({ ...ready, [fact]: false })).toBe(reason);
  });
});

describe('pluginJob', () => {
  const job: JobFacts = {
    id: 'job-1',
    type: 'post-submission-test:send-email',
    workspaceId: 'w1',
    formId: 'f1',
    submissionId: 's1',
    revisionId: 'r1',
    parentJobId: 'job-0',
    params: { options: { to: ['a@example.com'] } },
    createdBy: 'submitter',
    createdAt: new Date('2026-11-19T09:00:00Z'),
    attempt: 2,
    run: { number: 3, queuedAt: new Date('2026-11-19T10:00:00Z'), queuedBy: 'staff' },
  };

  it("gives a step its job's ids and none of the runner's own facts", () => {
    expect(pluginJob(job, 's1', 'r1')).toStrictEqual({
      id: 'job-1',
      type: 'post-submission-test:send-email',
      submissionId: 's1',
      revisionId: 'r1',
    });
  });
});

describe('previousStep', () => {
  const expiresAt = new Date('2026-11-25T00:00:00Z');
  const row = (overrides: Partial<JobOutputRow> = {}): JobOutputRow => ({
    jobId: 'step-1',
    status: 'succeeded',
    progressDone: null,
    progressTotal: null,
    resultExpiresAt: null,
    resultExpired: false,
    resultFileId: null,
    resultFilename: null,
    resultSize: null,
    resultContentType: null,
    resultStoredThisRun: false,
    ...overrides,
  });
  const stored = {
    resultExpiresAt: expiresAt,
    resultFileId: 'file-1',
    resultFilename: 'package.zip',
    resultSize: 2048,
    resultContentType: 'application/zip',
    resultStoredThisRun: true,
  };

  it('gives the step before, with the result it stored', () => {
    expect(previousStep(row(stored))).toEqual({
      jobId: 'step-1',
      result: {
        filename: 'package.zip',
        size: 2048,
        contentType: 'application/zip',
        expiresAt,
      },
    });
  });

  it('gives no result when the step before stored none, or its file is gone', () => {
    expect(previousStep(row()).result).toBeNull();
    expect(previousStep(row({ ...stored, resultExpired: true })).result).toBeNull();
    expect(
      previousStep(row({ ...stored, resultFileId: null, resultFilename: null })).result,
    ).toBeNull();
  });

  it('ends cancelled when the step before is gone', () => {
    expect(() => previousStep(undefined)).toThrow(
      new JobCancelledError('The step before it is gone'),
    );
  });
});
