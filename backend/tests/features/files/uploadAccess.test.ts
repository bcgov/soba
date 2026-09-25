jest.mock('../../../src/core/services/submitterAccess', () => ({
  ...jest.requireActual('../../../src/core/services/submitterAccess'),
  isSubmitterAllowed: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/submissionRepo', () => ({
  getSubmissionWorkspaceAndState: jest.fn(),
}));

import type { NextFunction, Request, Response } from 'express';
import { requireUploadAccess } from '../../../src/features/files/uploadAccess';
import { isSubmitterAllowed } from '../../../src/core/services/submitterAccess';
import { getSubmissionWorkspaceAndState } from '../../../src/core/db/repos/submissionRepo';
import { ConflictError, ForbiddenError } from '../../../src/core/errors';

const mockAllowed = jest.mocked(isSubmitterAllowed);
const mockSubmission = jest.mocked(getSubmissionWorkspaceAndState);

const upload = () =>
  ({
    actorId: 'u1',
    user: { providerCode: 'idir', profile: {} } as Express.User,
    params: {},
    body: { submissionId: 's1' },
  }) as unknown as Request;

const run = async (req: Request) => {
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  await requireUploadAccess(req, {} as Response, next);
  return next;
};

const inState = (workflowState: string) =>
  mockSubmission.mockResolvedValue({ workspaceId: 'ws1', formId: 'f1', workflowState });

beforeEach(() => {
  mockAllowed.mockReset();
  mockSubmission.mockReset();
  inState('draft');
});

describe('requireUploadAccess', () => {
  it('lets a caller who may write upload to an in-progress submission', async () => {
    mockAllowed.mockResolvedValue(true);
    const req = upload();
    const next = await run(req);
    expect(mockAllowed).toHaveBeenCalledWith(
      'write',
      { workspaceId: 'ws1', formId: 'f1', submissionId: 's1' },
      expect.objectContaining({ actorId: 'u1' }),
    );
    expect(next).toHaveBeenCalledWith();
    expect(req.coreContext).toMatchObject({ workspaceId: 'ws1', formId: 'f1' });
  });

  it('refuses access before revealing the state, so a non-writer gets 403 not 409', async () => {
    mockAllowed.mockResolvedValue(false);
    inState('submitted');
    expect(await run(upload())).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('is a 409 for a writer on a submitted submission', async () => {
    mockAllowed.mockResolvedValue(true);
    inState('submitted');
    expect(await run(upload())).toHaveBeenCalledWith(expect.any(ConflictError));
  });
});
