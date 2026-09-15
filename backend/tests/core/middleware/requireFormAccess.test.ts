jest.mock('../../../src/core/db/repos/formSubmitAccessRepo', () => ({
  hasFormSubmitAccess: jest.fn(),
}));

import type { NextFunction, Request, Response } from 'express';
import { requireFormAccess } from '../../../src/core/middleware/formSubmitAccess';
import { hasFormSubmitAccess } from '../../../src/core/db/repos/formSubmitAccessRepo';
import { Permissions } from '../../../src/core/db/codes';
import { ForbiddenError, UnauthorizedError } from '../../../src/core/errors';

const res = {} as Response;
const mockHas = jest.mocked(hasFormSubmitAccess);

function makeReq(opts: { workspaceId?: string; formId?: string; authed?: boolean }): Request {
  return {
    coreContext: opts.workspaceId
      ? {
          workspaceId: opts.workspaceId,
          formId: opts.formId,
          actorId: 'actor1',
          actorDisplayLabel: null,
          workspaceSource: 'submit:submission',
          role: 'member',
        }
      : undefined,
    user: opts.authed ? ({ providerCode: 'azureidir' } as Express.User) : undefined,
    idpType: opts.authed ? undefined : 'public',
    actorId: 'actor1',
    header: () => undefined,
  } as unknown as Request;
}

describe('requireFormAccess', () => {
  beforeEach(() => mockHas.mockReset());

  it('checks access against the resolved form', async () => {
    mockHas.mockResolvedValue(true);
    const next = jest.fn() as unknown as NextFunction;
    await requireFormAccess(Permissions.form_read)(
      makeReq({ workspaceId: 'ws1', formId: 'f1' }),
      res,
      next,
    );
    expect(mockHas).toHaveBeenCalledWith(
      { workspaceId: 'ws1', formId: 'f1' },
      expect.anything(),
      Permissions.form_read,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('denies an authenticated caller with 403', async () => {
    mockHas.mockResolvedValue(false);
    const next = jest.fn() as unknown as NextFunction;
    await requireFormAccess(Permissions.form_read)(
      makeReq({ workspaceId: 'ws1', formId: 'f1', authed: true }),
      res,
      next,
    );
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.statusCode).toBe(403);
  });

  it('denies an anonymous caller with 401', async () => {
    mockHas.mockResolvedValue(false);
    const next = jest.fn() as unknown as NextFunction;
    await requireFormAccess(Permissions.form_read)(
      makeReq({ workspaceId: 'ws1', formId: 'f1' }),
      res,
      next,
    );
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.statusCode).toBe(401);
  });

  it('errors when workspace context is missing', async () => {
    const next = jest.fn() as unknown as NextFunction;
    await requireFormAccess(Permissions.form_read)(makeReq({}), res, next);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ForbiddenError);
  });

  // A workspace alone can't answer for a form that overrides its audience.
  it('errors when the form was not resolved', async () => {
    const next = jest.fn() as unknown as NextFunction;
    await requireFormAccess(Permissions.form_read)(makeReq({ workspaceId: 'ws1' }), res, next);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ForbiddenError);
    expect(mockHas).not.toHaveBeenCalled();
  });
});
