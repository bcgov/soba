jest.mock('../../../../src/core/container', () => ({
  submissionsApiService: {},
  formVersionService: {},
  formsApiService: {},
}));
jest.mock('../../../../src/core/db/repos/submitterSubmissionRepo', () => ({
  findSubmitterSubmission: jest.fn(),
}));
jest.mock('../../../../src/features/submitter-email-copy/availability', () => ({
  isEmailCopyAvailable: jest.fn(),
}));
jest.mock('../../../../src/core/services/featureAvailabilityService', () => ({
  isFeatureAvailable: jest.fn(),
}));
jest.mock('../../../../src/features/notifications/service', () => ({
  notificationService: { enabled: jest.fn() },
}));
jest.mock('../../../../src/features/submitter-email-copy/repo', () => ({
  queueEmailCopy: jest.fn(),
}));

import express from 'express';
import request from 'supertest';
import { submitRouter } from '../../../../src/core/api/submit';
import { submitterEmailCopyRouter } from '../../../../src/features/submitter-email-copy/route';
import { findSubmitterSubmission } from '../../../../src/core/db/repos/submitterSubmissionRepo';
import { coreErrorHandler } from '../../../../src/core/middleware/errorHandler';
import { log } from '../../../../src/core/logging';
import { isEmailCopyAvailable } from '../../../../src/features/submitter-email-copy/availability';
import { isFeatureAvailable } from '../../../../src/core/services/featureAvailabilityService';
import { notificationService } from '../../../../src/features/notifications/service';
import { queueEmailCopy } from '../../../../src/features/submitter-email-copy/repo';
import { storedSubmission } from './storedSubmission';

const mockRead = jest.mocked(findSubmitterSubmission);
const mockAvailable = jest.mocked(isEmailCopyAvailable);
const mockFeature = jest.mocked(isFeatureAvailable);
const mockNotificationsOn = jest.mocked(notificationService.enabled);
const mockQueue = jest.mocked(queueEmailCopy);

// Stands in for checkJwt + resolveActorOrPublic. The routers, guards and @soba/lib rules are real.
function buildApp(caller: 'signedIn' | 'anonymous') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (caller === 'signedIn') {
      req.user = {
        providerCode: 'idir',
        profile: { displayLabel: 'Signed In' },
      } as unknown as Express.User;
      req.actorId = 'u1';
    } else {
      req.actorId = 'public-user';
      req.idpType = 'public';
    }
    next();
  });
  app.use('/api/v1/submit', submitRouter);
  app.use('/api/v1/submit/submissions', submitterEmailCopyRouter);
  app.use(coreErrorHandler);
  return app;
}

const signedIn = () => request(buildApp('signedIn'));
const anonymous = () => request(buildApp('anonymous'));
const BASE = '/api/v1/submit/submissions';

/** A submitted submission on a form whose confirmation settings allow an email copy. */
const submittedWithCopy = (
  overrides: Parameters<typeof storedSubmission>[0] = {},
): ReturnType<typeof storedSubmission> =>
  storedSubmission({
    workflowState: 'submitted',
    ...overrides,
    form: { allowSubmitterEmailCopy: true, ...overrides.form },
  });

beforeEach(() => {
  jest.resetAllMocks();
  mockAvailable.mockResolvedValue(true);
  mockFeature.mockResolvedValue(true);
  mockNotificationsOn.mockResolvedValue(true);
  mockQueue.mockResolvedValue({ jobId: 'job-1' });
});

describe('GET /submit/submissions/:id canEmailCopy', () => {
  it('offers a copy of a submitted submission where the form and environment allow it', async () => {
    mockRead.mockResolvedValue(submittedWithCopy());
    const res = await signedIn().get(`${BASE}/s1`);
    expect(res.status).toBe(200);
    expect(res.body.canEmailCopy).toBe(true);
    expect(mockAvailable).toHaveBeenCalledWith({ workspaceId: 'ws1', formId: 'f1' });
  });

  // A public form's submitter reads through the public user's grant, and may ask too.
  it('offers it to the public user on a public form', async () => {
    mockRead.mockResolvedValue(
      submittedWithCopy({ form: { audienceMode: 'public', permissions: [] } }),
    );
    const res = await anonymous().get(`${BASE}/s1`);
    expect(res.status).toBe(200);
    expect(res.body.canEmailCopy).toBe(true);
  });

  it('does not offer it when the feature or notifications are off', async () => {
    mockRead.mockResolvedValue(submittedWithCopy());
    mockAvailable.mockResolvedValue(false);
    const res = await signedIn().get(`${BASE}/s1`);
    expect(res.status).toBe(200);
    expect(res.body.canEmailCopy).toBe(false);
  });

  // The form's setting and the state decide first, so most reads look nothing else up.
  it.each([
    ['the form does not allow it', submittedWithCopy({ form: { allowSubmitterEmailCopy: false } })],
    ['the submission is a draft', submittedWithCopy({ workflowState: 'draft' })],
    ['the submission is sent back to revise', submittedWithCopy({ workflowState: 'revising' })],
  ])('does not offer it when %s', async (_label, stored) => {
    mockRead.mockResolvedValue(stored);
    const res = await signedIn().get(`${BASE}/s1`);
    expect(res.status).toBe(200);
    expect(res.body.canEmailCopy).toBe(false);
    expect(mockAvailable).not.toHaveBeenCalled();
  });
});

describe('POST /submit/submissions/:id/email-copy', () => {
  const emailCopy = (caller: typeof signedIn, body: unknown = { to: ' Pat@Example.COM ' }) =>
    caller()
      .post(`${BASE}/s1/email-copy`)
      .send(body as object);

  it('queues one copy to the address given, trimmed and lower-cased, and answers 202', async () => {
    mockRead.mockResolvedValue(submittedWithCopy());
    const res = await emailCopy(signedIn);
    expect(res.status).toBe(202);
    expect(res.text).toBe('');
    expect(mockFeature).toHaveBeenCalledWith('submitter-email-copy', {
      workspaceId: 'ws1',
      formId: 'f1',
    });
    expect(mockQueue).toHaveBeenCalledTimes(1);
    expect(mockQueue).toHaveBeenCalledWith(
      {
        workspaceId: 'ws1',
        formId: 'f1',
        submissionId: 's1',
        address: 'pat@example.com',
        requestedBy: 'u1',
        idpCode: 'idir',
        maxAttempts: 8,
      },
      { submission: 5, recipient: 10, form: 500, workspace: 2000, environment: 5000 },
    );
  });

  // The job reads the submission again as the requester, so it keeps the public user's provider.
  it('queues a copy for the public user on a public form', async () => {
    mockRead.mockResolvedValue(
      submittedWithCopy({ form: { audienceMode: 'public', permissions: [] } }),
    );
    const res = await emailCopy(anonymous);
    expect(res.status).toBe(202);
    expect(mockQueue.mock.calls[0][0]).toMatchObject({
      address: 'pat@example.com',
      requestedBy: 'public-user',
      idpCode: 'public',
    });
  });

  it.each([
    ['no address', {}],
    ['an invalid address', { to: 'not-an-email' }],
    ['a list of addresses', { to: ['a@example.com', 'b@example.com'] }],
    ['a priority', { to: 'a@example.com', priority: 'high' }],
  ])('refuses %s with 400 before reading the submission', async (_label, body) => {
    const res = await emailCopy(signedIn, body);
    expect(res.status).toBe(400);
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockQueue).not.toHaveBeenCalled();
  });

  it('answers 404 where the feature is off, as if the route did not exist', async () => {
    mockRead.mockResolvedValue(submittedWithCopy());
    mockFeature.mockResolvedValue(false);
    const res = await emailCopy(signedIn);
    expect(res.status).toBe(404);
    expect(mockQueue).not.toHaveBeenCalled();
  });

  it('answers 404 for a missing submission', async () => {
    mockRead.mockResolvedValue(null);
    const res = await emailCopy(signedIn);
    expect(res.status).toBe(404);
    expect(mockQueue).not.toHaveBeenCalled();
  });

  it.each([
    ['anonymously', anonymous, 401],
    ['signed in', signedIn, 403],
  ])('refuses a caller with no grant on the submission %s', async (_label, caller, status) => {
    mockRead.mockResolvedValue(submittedWithCopy({ role: null }));
    const res = await emailCopy(caller);
    expect(res.status).toBe(status);
    expect(res.body.code).toBe('read_denied');
    expect(mockQueue).not.toHaveBeenCalled();
  });

  // Signing in would not change the form's setting, so the public user gets 403 too.
  it.each([
    ['anonymously', anonymous],
    ['signed in', signedIn],
  ])('answers 403 %s when the form does not offer a copy', async (_label, caller) => {
    mockRead.mockResolvedValue(
      submittedWithCopy({
        form: { allowSubmitterEmailCopy: false, audienceMode: 'public', permissions: [] },
      }),
    );
    const res = await emailCopy(caller);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('email_copy_disabled');
    expect(mockQueue).not.toHaveBeenCalled();
  });

  it.each(['draft', 'revising'])('answers 409 for a submission that is %s', async (state) => {
    mockRead.mockResolvedValue(submittedWithCopy({ workflowState: state }));
    const res = await emailCopy(signedIn);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('email_copy_closed');
    expect(mockQueue).not.toHaveBeenCalled();
  });

  // The submitter is told, unlike a team notice past its limit, which is skipped quietly.
  it('answers 429 when an hourly limit is reached, without saying which', async () => {
    mockRead.mockResolvedValue(submittedWithCopy());
    mockQueue.mockResolvedValue({ limit: 'recipient' });
    const res = await emailCopy(signedIn);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('email_copy_limit_reached');
    expect(JSON.stringify(res.body)).not.toContain('recipient');
  });

  // The log names the limit for whoever tunes them, and never the address.
  it('logs which limit refused it, without the address', async () => {
    const warn = jest.spyOn(log, 'warn').mockImplementation(() => undefined);
    try {
      mockRead.mockResolvedValue(submittedWithCopy());
      mockQueue.mockResolvedValue({ limit: 'recipient' });
      await emailCopy(signedIn);
      expect(warn).toHaveBeenCalledWith(
        { formId: 'f1', submissionId: 's1', limit: 'recipient' },
        'Submitter email copy refused at its hourly limit',
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain('example.com');
    } finally {
      warn.mockRestore();
    }
  });

  it('answers 503 and queues nothing while notifications are off', async () => {
    mockRead.mockResolvedValue(submittedWithCopy());
    mockNotificationsOn.mockResolvedValue(false);
    const res = await emailCopy(signedIn);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('email_copy_unavailable');
    expect(mockQueue).not.toHaveBeenCalled();
  });
});
