jest.mock('../../../src/core/db/repos/formAccessRepo', () => ({
  resolveFormPermissions: jest.fn(),
  resolveWorkspacePermissions: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/membershipRepo', () => ({
  getActiveWorkspaceIdsForUser: jest.fn(),
}));

import type { NextFunction, Request, Response } from 'express';
import { requireFormPermissions } from '../../../src/core/middleware/requireFormPermissions';
import {
  resolveFormPermissions,
  resolveWorkspacePermissions,
} from '../../../src/core/db/repos/formAccessRepo';
import { getActiveWorkspaceIdsForUser } from '../../../src/core/db/repos/membershipRepo';
import { Permissions, type PermissionCode } from '../../../src/core/db/codes';
import { ForbiddenError } from '../../../src/core/errors';
import type {
  CoreListScope,
  CoreRequestContext,
} from '../../../src/core/middleware/requestContext';

const res = {} as Response;
const mockOnForm = jest.mocked(resolveFormPermissions);
const mockOnWorkspace = jest.mocked(resolveWorkspacePermissions);
const mockMemberships = jest.mocked(getActiveWorkspaceIdsForUser);

const FORM_READ_ACCESS = { actorId: 'actor1', required: [Permissions.form_read] };

const context = (formId?: string): CoreRequestContext => ({
  workspaceId: 'ws1',
  actorId: 'actor1',
  actorDisplayLabel: null,
  workspaceSource: 'test',
  role: 'member',
  ...(formId ? { formId } : {}),
});

const anchoredScope = (): CoreListScope => ({
  actorId: 'actor1',
  workspaceIds: ['ws1'],
  selectedWorkspaceId: 'ws1',
});

const makeReq = (coreContext?: CoreRequestContext, listScope?: CoreListScope) =>
  ({ coreContext, listScope }) as unknown as Request;

const run = async (req: Request, required: PermissionCode[] = [Permissions.form_read]) => {
  const next = jest.fn() as unknown as NextFunction;
  await requireFormPermissions(required)(req, res, next);
  return next;
};

describe('requireFormPermissions', () => {
  beforeEach(() => {
    mockOnForm.mockReset();
    mockOnWorkspace.mockReset();
    mockMemberships.mockReset();
  });

  it('checks the form in context and keeps the codes it resolved', async () => {
    mockOnForm.mockResolvedValue(new Set([Permissions.form_read]));
    const req = makeReq(context('f1'));

    const next = await run(req);

    expect(mockOnForm).toHaveBeenCalledWith('actor1', 'ws1', 'f1');
    expect(mockOnWorkspace).not.toHaveBeenCalled();
    expect(req.coreContext?.permissions).toEqual(new Set([Permissions.form_read]));
    expect(next).toHaveBeenCalledWith();
  });

  it('refuses a form whose codes miss one required', async () => {
    mockOnForm.mockResolvedValue(new Set([Permissions.form_read]));

    const next = await run(makeReq(context('f1')), [
      Permissions.form_read,
      Permissions.design_update,
    ]);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('checks the workspace when no form is in context', async () => {
    mockOnWorkspace.mockResolvedValue(new Set([Permissions.all]));

    const next = await run(makeReq(context()), [Permissions.form_create]);

    expect(mockOnWorkspace).toHaveBeenCalledWith('actor1', 'ws1');
    expect(mockOnForm).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('refuses the workspace when its codes miss one required', async () => {
    mockOnWorkspace.mockResolvedValue(new Set([Permissions.form_read]));

    const next = await run(makeReq(context()), [Permissions.form_create]);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('fails when no workspace was resolved', async () => {
    const next = await run(makeReq());

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next).not.toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('checks the form of a form-anchored list and passes its filter on', async () => {
    mockOnForm.mockResolvedValue(new Set([Permissions.form_read]));
    const req = makeReq(context('f1'), anchoredScope());

    const next = await run(req);

    expect(mockOnForm).toHaveBeenCalledWith('actor1', 'ws1', 'f1');
    expect(req.listScope?.formAccess).toEqual(FORM_READ_ACCESS);
    expect(next).toHaveBeenCalledWith();
  });

  it('refuses a form-anchored list when the form misses a code', async () => {
    mockOnForm.mockResolvedValue(new Set());

    const next = await run(makeReq(context('f1'), anchoredScope()));

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('filters a workspace-anchored list per form', async () => {
    const req = makeReq(context(), anchoredScope());

    const next = await run(req);

    expect(req.listScope).toEqual({ ...anchoredScope(), formAccess: FORM_READ_ACCESS });
    expect(mockOnWorkspace).not.toHaveBeenCalled();
    expect(mockMemberships).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('lists across every active membership when no workspace is named', async () => {
    mockMemberships.mockResolvedValue(['ws1', 'ws2']);
    const req = makeReq(undefined, { actorId: 'actor1', workspaceIds: [] });

    const next = await run(req);

    expect(mockMemberships).toHaveBeenCalledWith('actor1');
    expect(req.listScope).toEqual({
      actorId: 'actor1',
      workspaceIds: ['ws1', 'ws2'],
      formAccess: FORM_READ_ACCESS,
    });
    expect(next).toHaveBeenCalledWith();
  });
});
