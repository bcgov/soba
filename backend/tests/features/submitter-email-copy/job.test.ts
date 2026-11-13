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
import type { ClaimedJob } from '../../../src/core/db/repos/jobRepo';
import { findSubmitterSubmission } from '../../../src/core/db/repos/submitterSubmissionRepo';
import type { JobNotifications } from '../../../src/core/integrations/notification/JobNotifications';
import type { SendEmail } from '../../../src/core/integrations/notification/NotificationAdapter';
import { NOTIFICATIONS_OFF } from '../../../src/core/integrations/notification/sendEachAddress';
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

const run = (job: Partial<ClaimedJob> = {}) =>
  runEmailCopy({
    job: {
      id: 'job-1',
      type: 'submission.email-copy',
      workspaceId: 'ws1',
      formId: 'f1',
      submissionId: 's1',
      createdBy: 'public-user',
      lastRequeuedBy: null,
      lastRequeuedAt: null,
      params: { requestId: REQUEST_ID },
      ...job,
    } as ClaimedJob,
    signal: new AbortController().signal,
    log: { info: jest.fn(), warn: jest.fn() } as unknown as Logger,
  } as unknown as JobContext);

const submitted = (form: Record<string, unknown> = {}) =>
  storedSubmission({
    workflowState: 'submitted',
    form: { allowSubmitterEmailCopy: true, audienceMode: 'public', permissions: [], ...form },
  });

/** The actor the job's sends are attributed to. */
const actor = async (): Promise<string> => {
  const [, actorId] = mockJobNotifications.mock.calls[0] as [ClaimedJob, () => Promise<string>];
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
  expect(mockFeature).toHaveBeenCalledWith('submitter-email-copy', {
    workspaceId: 'ws1',
    formId: 'f1',
  });
  expect(emails.map((email) => email.recipients.to)).toEqual([[ADDRESS]]);
  expect(emails[0].content.subject).toContain('Permit application');
  expect(emails[0].content.body).toContain('<strong>K7M2Q9XA</strong>');
  expect(emails[0].content.body).toContain('href="https://forms.example/en/submission/s1"');
  await expect(actor()).resolves.toBe('public-user');
});

it('attributes a re-run to whoever ran the job again', async () => {
  await run({ lastRequeuedBy: 'admin-1' });
  await expect(actor()).resolves.toBe('admin-1');
});

// The public user's submissions are no one's own, so only a signed-in requester gets the list.
it.each([
  ['the public user', 'public', false],
  ['a requester with no provider', null, false],
  ['a signed-in requester', 'idir', true],
] as const)('links past submissions for %s: %s', async (_label, idpCode, linked) => {
  mockRequest.mockResolvedValue({ ...REQUEST, idpCode });
  await run();
  expect(emails[0].content.body.includes('/en/my-submissions')).toBe(linked);
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
  ['the feature was turned off', () => mockFeature.mockResolvedValue(false), EMAIL_COPY_TURNED_OFF],
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
