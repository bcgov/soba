jest.mock('../../../src/core/db/repos/submitterSubmissionRepo', () => ({
  findSubmitterSubmission: jest.fn(),
}));

import type { NextFunction, Request, Response } from 'express';
import { requireUploadAccess } from '../../../src/features/files/uploadAccess';
import { findSubmitterSubmission } from '../../../src/core/db/repos/submitterSubmissionRepo';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../src/core/errors';
import { storedSubmission } from '../../core/api/submit/storedSubmission';

const mockRead = jest.mocked(findSubmitterSubmission);

const upload = (body: Record<string, unknown> = { submissionId: 's1' }) =>
  ({
    actorId: 'u1',
    user: { providerCode: 'idir', profile: {} } as Express.User,
    params: {},
    body,
  }) as unknown as Request;

const anonymousUpload = () =>
  ({
    actorId: 'public-user',
    idpType: 'public',
    params: {},
    body: { submissionId: 's1' },
  }) as unknown as Request;

const run = async (req: Request) => {
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  await requireUploadAccess(req, {} as Response, next);
  return next;
};

beforeEach(() => {
  mockRead.mockReset();
  mockRead.mockResolvedValue(storedSubmission());
});

describe('requireUploadAccess', () => {
  it.each(['draft', 'opened'])(
    'lets a caller who may write upload to a %s submission',
    async (workflowState) => {
      mockRead.mockResolvedValue(storedSubmission({ workflowState }));
      const req = upload();
      const next = await run(req);
      expect(mockRead).toHaveBeenCalledWith({ submissionId: 's1', actorId: 'u1', idpCode: 'idir' });
      expect(next).toHaveBeenCalledWith();
      expect(req.coreContext).toMatchObject({ workspaceId: 'ws1', formId: 'f1', actorId: 'u1' });
    },
  );

  it('refuses access before revealing the state, 403 signed in and 401 anonymous', async () => {
    mockRead.mockResolvedValue(
      storedSubmission({ workflowState: 'submitted', form: { permissions: [] } }),
    );
    expect(await run(upload())).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(await run(anonymousUpload())).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('refuses a caller without a grant', async () => {
    mockRead.mockResolvedValue(storedSubmission({ role: null }));
    expect(await run(upload())).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('is a 409 for a writer on a submitted submission', async () => {
    mockRead.mockResolvedValue(storedSubmission({ workflowState: 'submitted' }));
    expect(await run(upload())).toHaveBeenCalledWith(expect.any(ConflictError));
  });

  it('is a 404 when the submission is not live', async () => {
    mockRead.mockResolvedValue(null);
    expect(await run(upload())).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it('needs a submissionId, with no read', async () => {
    expect(await run(upload({}))).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(mockRead).not.toHaveBeenCalled();
  });
});
