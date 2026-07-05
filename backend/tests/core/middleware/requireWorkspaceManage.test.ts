import type { NextFunction, Request, Response } from 'express';
import { requireWorkspaceManage } from '../../../src/core/middleware/requireWorkspaceManage';
import { ForbiddenError } from '../../../src/core/errors';

function makeReq(role?: string): Request {
  const coreContext = role
    ? {
        workspaceId: 'ws1',
        actorId: 'actor1',
        actorDisplayLabel: 'Actor One',
        workspaceSource: 'resource:workspace',
        role,
      }
    : undefined;
  return { coreContext } as unknown as Request;
}

const res = {} as Response;

describe('requireWorkspaceManage', () => {
  it.each(['owner', 'admin'])('passes for %s', (role) => {
    const next = jest.fn() as unknown as NextFunction;
    requireWorkspaceManage(makeReq(role), res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it.each(['member', 'viewer'])('forbids %s', (role) => {
    const next = jest.fn() as unknown as NextFunction;
    requireWorkspaceManage(makeReq(role), res, next);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.statusCode).toBe(403);
  });

  it('errors when workspace context is missing', () => {
    const next = jest.fn() as unknown as NextFunction;
    requireWorkspaceManage(makeReq(), res, next);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ForbiddenError);
  });
});
