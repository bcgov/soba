import { z } from 'zod';
import type { JobOutputRow } from '../../../src/core/db/repos/jobOutputRepo';
import type { PostSubmissionActionPluginDefinition } from '../../../src/core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import type { JobFacts } from '../../../src/core/jobs/facts';
import { getJobSettings } from '../../../src/core/jobs/settings';
import { JobCancelledError } from '../../../src/core/jobs/settlement';
import {
  actionJobDefinitions,
  cancelReason,
  nextStepJob,
  previousStep,
  type ActionRunFacts,
} from '../../../src/features/post-submission/actionJob';
import type { ActionJobParams } from '../../../src/features/post-submission/params';

jest.mock('../../../src/core/db/client', () => ({ db: {}, quietDb: {} }));

const ready: ActionRunFacts = {
  postSubmissionAvailable: true,
  enabledHere: true,
  featureAvailable: true,
  live: true,
  stillEnabled: true,
};

const run = () => Promise.resolve();

const plugin = (
  job: Partial<PostSubmissionActionPluginDefinition['job']> = {},
  steps?: PostSubmissionActionPluginDefinition['steps'],
): PostSubmissionActionPluginDefinition => ({
  code: 'post-submission-test',
  metadata: { code: 'post-submission-test', name: 'Test' },
  scopes: ['form'],
  optionsSchema: z.object({}),
  job: { pool: 'heavy', run, ...job },
  steps,
});

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

describe('actionJobDefinitions', () => {
  it("takes the first step's settings from the plugin's job", () => {
    expect(
      actionJobDefinitions(
        plugin({
          maxAttempts: 8,
          timeoutMs: 900_000,
          resultRetentionDays: 30,
          keepResultWhenEnded: true,
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        type: 'post-submission-test',
        pool: 'heavy',
        maxAttempts: 8,
        timeoutMs: 900_000,
        resultRetentionDays: 30,
        keepResultWhenEnded: true,
      }),
    ]);
  });

  it('leaves unset what the plugin leaves unset', () => {
    const [definition] = actionJobDefinitions(plugin());
    expect(definition.resultRetentionDays).toBeUndefined();
    expect(definition.keepResultWhenEnded).toBeUndefined();
  });

  it('adds a job type for each later step, typed by the code and the step, with its settings', () => {
    const definitions = actionJobDefinitions(
      plugin({}, [
        { name: 'send-email', pool: 'light', maxAttempts: 12, run },
        { name: 'tidy', pool: 'light', timeoutMs: 60_000, run },
      ]),
    );
    expect(
      definitions.map(({ type, pool, maxAttempts, timeoutMs }) => ({
        type,
        pool,
        maxAttempts,
        timeoutMs,
      })),
    ).toEqual([
      { type: 'post-submission-test', pool: 'heavy', maxAttempts: undefined, timeoutMs: undefined },
      {
        type: 'post-submission-test:send-email',
        pool: 'light',
        maxAttempts: 12,
        timeoutMs: undefined,
      },
      {
        type: 'post-submission-test:tidy',
        pool: 'light',
        maxAttempts: undefined,
        timeoutMs: 60_000,
      },
    ]);
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
        state: 'ready',
        filename: 'package.zip',
        size: 2048,
        contentType: 'application/zip',
        expiresAt,
      },
    });
  });

  it('gives an expired result as expired, and no result as none', () => {
    expect(previousStep(row({ ...stored, resultExpired: true })).result).toEqual({
      state: 'expired',
      expiresAt,
    });
    expect(previousStep(row()).result).toBeNull();
  });

  it('ends cancelled when retention has deleted the step before', () => {
    expect(() => previousStep(undefined)).toThrow(
      new JobCancelledError('The step before it is gone'),
    );
  });
});

describe('nextStepJob', () => {
  const params: ActionJobParams = {
    options: { to: ['staff@example.com'] },
    source: { scope: 'form', settingId: 'setting-1', version: 2 },
  };
  // As stored, with a key the parser drops.
  const stored: Record<string, unknown> = { ...params, recordedAt: '2026-11-18T00:00:00Z' };
  const job = {
    id: 'step-1',
    formId: 'f1',
    submissionId: 's1',
    revisionId: 'r1',
    createdBy: 'u1',
    params: stored,
  } as JobFacts;

  it('is a child with the same ids and params as stored, deduped per parent', () => {
    expect(
      nextStepJob(
        job,
        { type: 'post-submission-test:send-email', pool: 'light', maxAttempts: 12, run },
        params,
      ),
    ).toEqual({
      type: 'post-submission-test:send-email',
      formId: 'f1',
      submissionId: 's1',
      revisionId: 'r1',
      actionConfigId: 'setting-1',
      createdBy: 'u1',
      params: stored,
      dedupeKey: 'post-submission-test:send-email:step-1',
      maxAttempts: 12,
    });
  });

  it('takes JOB_MAX_ATTEMPTS for a step that sets no attempts', () => {
    const next = { type: 'post-submission-test:tidy', pool: 'light' as const, run };
    expect(nextStepJob(job, next, params).maxAttempts).toBe(getJobSettings().maxAttempts);
  });
});
