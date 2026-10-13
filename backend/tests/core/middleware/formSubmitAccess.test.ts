jest.mock('../../../src/core/services/submitterAccess', () => ({
  ...jest.requireActual('../../../src/core/services/submitterAccess'),
  isSubmitterAllowed: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/submissionRepo', () => ({
  getSubmissionWorkspaceAndState: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/formRepo', () => ({
  getWorkspaceIdForForm: jest.fn(),
}));

import type { NextFunction, Request, Response } from 'express';
import {
  requireFormSubmitAccess,
  requireSubmissionRead,
} from '../../../src/core/middleware/formSubmitAccess';
import { isSubmitterAllowed } from '../../../src/core/services/submitterAccess';
import { getSubmissionWorkspaceAndState } from '../../../src/core/db/repos/submissionRepo';
import { getWorkspaceIdForForm } from '../../../src/core/db/repos/formRepo';
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../../src/core/errors';

const mockAllowed = jest.mocked(isSubmitterAllowed);
const mockSubmission = jest.mocked(getSubmissionWorkspaceAndState);
const mockFormWorkspace = jest.mocked(getWorkspaceIdForForm);
const res = {} as Response;

interface ReqOpts {
  authed?: boolean;
  id?: string;
  body?: Record<string, unknown>;
  context?: { workspaceId: string; formId?: string };
}

function makeReq(opts: ReqOpts): Request {
  return {
    actorId: opts.authed ? 'u1' : 'public-user',
    user: opts.authed ? ({ providerCode: 'idir', profile: {} } as Express.User) : undefined,
    idpType: opts.authed ? undefined : 'public',
    params: opts.id ? { id: opts.id } : {},
    body: opts.body ?? {},
    coreContext: opts.context,
  } as unknown as Request;
}

const run = async (
  middleware: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  req: Request,
) => {
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  await middleware(req, res, next);
  return next;
};

beforeEach(() => {
  mockAllowed.mockReset();
  mockSubmission.mockReset();
  mockFormWorkspace.mockReset();
  mockSubmission.mockResolvedValue({ workspaceId: 'ws1', formId: 'f1', workflowState: 'draft' });
  mockFormWorkspace.mockResolvedValue('ws2');
});

describe('requireFormSubmitAccess', () => {
  it('authorizes a save or submit as a write on the routed submission', async () => {
    mockAllowed.mockResolvedValue(true);
    const req = makeReq({ authed: true, id: 's1' });
    const next = await run(requireFormSubmitAccess, req);
    expect(mockAllowed).toHaveBeenCalledWith(
      'write',
      { workspaceId: 'ws1', formId: 'f1', submissionId: 's1' },
      expect.objectContaining({ actorId: 'u1' }),
    );
    expect(next).toHaveBeenCalledWith();
    expect(req.coreContext).toMatchObject({ workspaceId: 'ws1', formId: 'f1', actorId: 'u1' });
  });

  it('keeps a body formId from turning a write into an open', async () => {
    mockAllowed.mockResolvedValue(true);
    await run(
      requireFormSubmitAccess,
      makeReq({ authed: true, id: 's1', body: { formId: 'other' } }),
    );
    expect(mockFormWorkspace).not.toHaveBeenCalled();
    expect(mockAllowed.mock.calls[0][0]).toBe('write');
    expect(mockAllowed.mock.calls[0][1]).toMatchObject({ formId: 'f1', submissionId: 's1' });
  });

  it('authorizes an open against the form in the body', async () => {
    mockAllowed.mockResolvedValue(true);
    const req = makeReq({ body: { formId: 'f9' } });
    const next = await run(requireFormSubmitAccess, req);
    expect(mockAllowed).toHaveBeenCalledWith(
      'open',
      { workspaceId: 'ws2', formId: 'f9' },
      expect.objectContaining({ actorId: 'public-user' }),
    );
    expect(next).toHaveBeenCalledWith();
    expect(req.coreContext).toMatchObject({ workspaceId: 'ws2', formId: 'f9' });
  });

  it('refuses a caller who may not write, 403 signed in and 401 anonymous, without a context', async () => {
    mockAllowed.mockResolvedValue(false);
    const signedIn = makeReq({ authed: true, id: 's1' });
    expect(await run(requireFormSubmitAccess, signedIn)).toHaveBeenCalledWith(
      expect.any(ForbiddenError),
    );
    expect(signedIn.coreContext).toBeUndefined();
    expect(await run(requireFormSubmitAccess, makeReq({ id: 's1' }))).toHaveBeenCalledWith(
      expect.any(UnauthorizedError),
    );
  });

  it('is a 404 for a missing submission', async () => {
    mockSubmission.mockResolvedValue(null);
    const next = await run(requireFormSubmitAccess, makeReq({ authed: true, id: 's1' }));
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    expect(mockAllowed).not.toHaveBeenCalled();
  });
});

describe('requireSubmissionRead', () => {
  const context = { workspaceId: 'ws1', formId: 'f1' };

  it('authorizes a read of the routed submission', async () => {
    mockAllowed.mockResolvedValue(true);
    const next = await run(requireSubmissionRead, makeReq({ authed: true, id: 's1', context }));
    expect(mockAllowed).toHaveBeenCalledWith(
      'read',
      { workspaceId: 'ws1', formId: 'f1', submissionId: 's1' },
      expect.objectContaining({ actorId: 'u1' }),
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('refuses a caller who may not read, 403 signed in and 401 anonymous', async () => {
    mockAllowed.mockResolvedValue(false);
    expect(
      await run(requireSubmissionRead, makeReq({ authed: true, id: 's1', context })),
    ).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(await run(requireSubmissionRead, makeReq({ id: 's1', context }))).toHaveBeenCalledWith(
      expect.any(UnauthorizedError),
    );
  });

  it.each([
    ['no resolved form', makeReq({ authed: true, id: 's1' })],
    ['no routed id', makeReq({ authed: true, context })],
  ])('fails as a server error with %s', async (_label, req) => {
    const next = await run(requireSubmissionRead, req);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AppError);
    expect(mockAllowed).not.toHaveBeenCalled();
  });
});
