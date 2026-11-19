import type { JobRecord } from '../../../src/core/db/repos/jobRepo';
import { jobFacts } from '../../../src/core/jobs/facts';

const createdAt = new Date('2026-11-01T09:00:00Z');
const rerunAt = new Date('2026-11-02T10:00:00Z');

const row = (overrides: Partial<JobRecord> = {}): JobRecord =>
  ({
    id: 'job-1',
    type: 'post-submission-log',
    workspaceId: 'ws1',
    formId: 'f1',
    submissionId: 's1',
    revisionId: 'r1',
    params: { options: {} },
    createdBy: 'actor-1',
    createdAt,
    attempts: 2,
    requeueCount: 0,
    lastRequeuedAt: null,
    lastRequeuedBy: null,
    claimToken: 'claim-1',
    leaseUntil: new Date('2026-11-01T09:05:00Z'),
    ...overrides,
  }) as JobRecord;

describe('jobFacts', () => {
  it('gives the ids, params, creator, attempt and first run, and nothing of the claim', () => {
    expect(jobFacts(row())).toEqual({
      id: 'job-1',
      type: 'post-submission-log',
      workspaceId: 'ws1',
      formId: 'f1',
      submissionId: 's1',
      revisionId: 'r1',
      params: { options: {} },
      createdBy: 'actor-1',
      createdAt,
      attempt: 2,
      run: { number: 1, queuedAt: createdAt, queuedBy: 'actor-1' },
    });
  });

  it('numbers a re-run and dates it from when it was queued, by whoever ran it again', () => {
    expect(
      jobFacts(row({ requeueCount: 2, lastRequeuedAt: rerunAt, lastRequeuedBy: 'admin-1' })).run,
    ).toEqual({ number: 3, queuedAt: rerunAt, queuedBy: 'admin-1' });
  });
});
