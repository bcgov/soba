const mockRequest = jest.fn();
jest.mock('../../../src/features/submitter-email-copy/repo', () => ({
  findEmailCopyRequest: (...args: unknown[]) => mockRequest(...args),
}));
jest.mock('../../../src/core/db/repos/submitterSubmissionRepo', () => ({
  findSubmitterSubmission: jest.fn(),
}));
jest.mock('../../../src/core/services/featureAvailabilityService', () => ({
  isFeatureAvailable: jest.fn(),
}));
const mockJobNotifications = jest.fn();
jest.mock('../../../src/features/notifications/jobNotifications', () => ({
  jobNotifications: (...args: unknown[]) => mockJobNotifications(...args),
}));
jest.mock('../../../src/core/config/env', () => ({
  JobPool: { light: 'light', heavy: 'heavy' },
  env: { getFormsAppUrl: () => 'https://forms.example' },
}));

import type { Logger } from 'pino';
import { findSubmitterSubmission } from '../../../src/core/db/repos/submitterSubmissionRepo';
import type { JobNotifications } from '../../../src/core/integrations/notification/JobNotifications';
import type { SendEmail } from '../../../src/core/integrations/notification/NotificationAdapter';
import { NOTIFICATIONS_OFF } from '../../../src/core/integrations/notification/sendEachAddress';
import type { JobFacts } from '../../../src/core/jobs/facts';
import type { JobContext } from '../../../src/core/jobs/registry';
import { JobCancelledError } from '../../../src/core/jobs/settlement';
import { submitterEmailCopyJob } from '../../../src/core/jobs/submitterEmailCopy';
import { isFeatureAvailable } from '../../../src/core/services/featureAvailabilityService';
import {
  EMAIL_COPY_GONE,
  EMAIL_COPY_NOT_ALLOWED,
  EMAIL_COPY_REQUEST_GONE,
  EMAIL_COPY_TURNED_OFF,
  runEmailCopy,
} from '../../../src/features/submitter-email-copy/job';
import { storedSubmission } from '../../core/api/submit/storedSubmission';

const mockRead = jest.mocked(findSubmitterSubmission);
const mockFeature = jest.mocked(isFeatureAvailable);

const REQUEST_ID = '0190f3a2-7c1e-7a4b-9d2e-5f6a7b8c9d0e';
const ADDRESS = 'pat@example.com';
const REQUEST = {
  id: REQUEST_ID,
  workspaceId: 'ws1',
  formId: 'f1',
  submissionId: 's1',
  address: ADDRESS,
  requestedBy: 'public-user',
  idpCode: 'public',
  createdAt: new Date(),
};

let emails: SendEmail[] = [];
let outcome: { outcome: string; httpStatus: number | null; audited: boolean };

const run = (job: Partial<JobFacts> = {}) =>
  runEmailCopy({
    job: {
      id: 'job-1',
      type: 'submission.email-copy',
      workspaceId: 'ws1',
      formId: 'f1',
      submissionId: 's1',
      createdBy: 'public-user',
      params: { requestId: REQUEST_ID },
      run: { number: 1, queuedAt: new Date('2026-11-01T00:00:00Z'), queuedBy: 'public-user' },
      ...job,
    } as JobFacts,
    signal: new AbortController().signal,
    log: { info: jest.fn(), warn: jest.fn() } as unknown as Logger,
  } as unknown as JobContext);

const submitted = (form: Record<string, unknown> = {}) =>
  storedSubmission({
    workflowState: 'submitted',
    form: { allowSubmitterEmailCopy: true, audienceMode: 'public', permissions: [], ...form },
  });

const featureOff = (code: string) =>
  mockFeature.mockImplementation((feature) => Promise.resolve(feature !== code));

/** The actor the job's sends are attributed to. */
const actor = async (): Promise<string> => {
  const [, actorId] = mockJobNotifications.mock.calls[0] as [JobFacts, () => Promise<string>];
  return actorId();
};

beforeEach(() => {
  jest.resetAllMocks();
  emails = [];
  outcome = { outcome: 'accepted', httpStatus: null, audited: true };
  mockRequest.mockResolvedValue(REQUEST);
  mockRead.mockResolvedValue(submitted());
  mockFeature.mockResolvedValue(true);
  mockJobNotifications.mockImplementation(
    (): JobNotifications => ({
      enabled: () => Promise.resolve(outcome.outcome !== 'disabled'),
      sendEmail: (email) => {
        emails.push(email);
        return Promise.resolve(outcome as never);
      },
      handled: () =>
        Promise.resolve({ recipients: new Set<string>(), runStarted: false, anySent: false }),
      sentSince: () => Promise.resolve(0),
    }),
  );
});

it('runs on the light pool with retries to ride out a provider outage', () => {
  expect(submitterEmailCopyJob).toMatchObject({
    type: 'submission.email-copy',
    pool: 'light',
    maxAttempts: 8,
  });
});

it('reads the request and the submission as the requester, and sends one email to the address', async () => {
  await run();
  expect(mockRequest).toHaveBeenCalledWith(REQUEST_ID, 's1');
  expect(mockRead).toHaveBeenCalledWith({
    submissionId: 's1',
    actorId: 'public-user',
    idpCode: 'public',
  });
  for (const code of ['confirmation-screen', 'confirmation-email-copy']) {
    expect(mockFeature).toHaveBeenCalledWith(code, { workspaceId: 'ws1', formId: 'f1' });
  }
  expect(emails.map((email) => email.recipients.to)).toEqual([[ADDRESS]]);
  expect(emails[0].content.subject).toContain('Permit application');
  expect(emails[0].content.body).toContain('<strong>K7M2Q9XA</strong>');
  await expect(actor()).resolves.toBe('public-user');
});

it('attributes a re-run to whoever ran the job again', async () => {
  await run({
    run: { number: 2, queuedAt: new Date('2026-11-02T00:00:00Z'), queuedBy: 'admin-1' },
  });
  await expect(actor()).resolves.toBe('admin-1');
});

// Anyone with the link can open the public user's submission, so only a signed-in requester gets
// links; past submissions only on a form that is not public.
it.each([
  ['the public user on a public form', 'public', 'public', false, false],
  ['a requester with no provider', null, 'public', false, false],
  ['a signed-in requester on a public form', 'idir', 'public', true, false],
  ['a signed-in requester on a protected form', 'idir', 'protected', true, true],
] as const)('links for %s', async (_label, idpCode, audienceMode, submissionLinked, pastLinked) => {
  mockRequest.mockResolvedValue({ ...REQUEST, idpCode });
  mockRead.mockResolvedValue(submitted({ audienceMode }));
  await run();
  const { body } = emails[0].content;
  expect(body.includes('href="https://forms.example/en/submission/s1"')).toBe(submissionLinked);
  expect(body.includes('/en/my-submissions')).toBe(pastLinked);
});

// What the request checked may have changed while the job waited.
it.each([
  ['the request is gone', () => mockRequest.mockResolvedValue(null), EMAIL_COPY_REQUEST_GONE],
  ['the submission is gone', () => mockRead.mockResolvedValue(null), EMAIL_COPY_GONE],
  [
    'the form no longer offers a copy',
    () => mockRead.mockResolvedValue(submitted({ allowSubmitterEmailCopy: false })),
    EMAIL_COPY_NOT_ALLOWED,
  ],
  [
    'the requester lost their grant',
    () =>
      mockRead.mockResolvedValue({ ...submitted(), access: { ...submitted().access, role: null } }),
    EMAIL_COPY_NOT_ALLOWED,
  ],
  [
    'the submission was sent back to revise',
    () =>
      mockRead.mockResolvedValue(
        storedSubmission({
          workflowState: 'revising',
          form: { allowSubmitterEmailCopy: true, audienceMode: 'public', permissions: [] },
        }),
      ),
    EMAIL_COPY_NOT_ALLOWED,
  ],
  [
    'the confirmation screen was turned off',
    () => featureOff('confirmation-screen'),
    EMAIL_COPY_TURNED_OFF,
  ],
  ['email copy was turned off', () => featureOff('confirmation-email-copy'), EMAIL_COPY_TURNED_OFF],
])('ends cancelled without sending when %s', async (_label, arrange, reason) => {
  arrange();
  await expect(run()).rejects.toThrow(new JobCancelledError(reason));
  expect(emails).toEqual([]);
});

it('ends cancelled when the job names no submission', async () => {
  await expect(run({ submissionId: null })).rejects.toThrow(
    new JobCancelledError(EMAIL_COPY_REQUEST_GONE),
  );
  expect(mockRequest).not.toHaveBeenCalled();
});

it('ends cancelled when notifications are off', async () => {
  outcome = { outcome: 'disabled', httpStatus: null, audited: true };
  await expect(run()).rejects.toThrow(new JobCancelledError(NOTIFICATIONS_OFF));
});

// Thrown, not cancelled, so the job retries.
it('retries after a provider error', async () => {
  outcome = { outcome: 'error', httpStatus: 503, audited: true };
  const error = await run().catch((err: unknown) => err);
  expect(error).toBeInstanceOf(Error);
  expect(error).not.toBeInstanceOf(JobCancelledError);
});

// Cancel reasons show in the Jobs tabs, so they name no address.
it('ends cancelled when the provider refuses the address, without naming it', async () => {
  outcome = { outcome: 'error', httpStatus: 400, audited: true };
  const error = await run().catch((err: unknown) => err);
  expect(error).toBeInstanceOf(JobCancelledError);
  expect(String(error)).not.toContain(ADDRESS);
});
