const selectMock = jest.fn();

jest.mock('../../../src/core/db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

jest.mock('../../../src/core/db/repos/idpGroupRepo', () => ({
  listGroupsForIdp: jest.fn(),
}));

jest.mock('../../../src/core/db/repos/membershipRepo', () => ({
  getWorkspaceForUser: jest.fn(),
}));

import type { NextFunction, Request, Response } from 'express';
import { checkFormVisibility } from '../../../src/core/middleware/formVisibility';
import { listGroupsForIdp } from '../../../src/core/db/repos/idpGroupRepo';

/** Mimics the drizzle `select().from().where().limit()` chain, resolving to `result`. */
function selectChain(result: unknown) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(result),
      }),
    }),
  };
}

function makeRes() {
  const res: Partial<Response> & { status: jest.Mock; json: jest.Mock } = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('checkFormVisibility IDP matching', () => {
  beforeEach(() => {
    selectMock.mockReset();
    jest.mocked(listGroupsForIdp).mockReset();
  });

  it('allows an AzureIDIR user when visibility = [azureidir]', async () => {
    selectMock.mockReturnValue(
      selectChain([{ id: 'fv1', visibility: ['azureidir'], workspaceId: 'ws1' }]),
    );
    jest.mocked(listGroupsForIdp).mockResolvedValue(['bcgov']);

    const req = {
      body: { formVersionId: 'fv1' },
      params: {},
      path: '/submissions',
      actorId: 'actor1',
      user: { providerCode: 'azureidir', profile: { displayLabel: 'Test User' } },
    } as unknown as Request;
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await checkFormVisibility(req, res as Response, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('denies a BCeID user when visibility = [azureidir]', async () => {
    selectMock.mockReturnValue(
      selectChain([{ id: 'fv1', visibility: ['azureidir'], workspaceId: 'ws1' }]),
    );
    jest.mocked(listGroupsForIdp).mockResolvedValue(['bceid']);

    const req = {
      body: { formVersionId: 'fv1' },
      params: {},
      path: '/submissions',
      actorId: 'actor2',
      user: { providerCode: 'bceidbasic', profile: { displayLabel: 'BCeID User' } },
    } as unknown as Request;
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await checkFormVisibility(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a public form without authentication', async () => {
    selectMock
      .mockReturnValueOnce(selectChain([{ id: 'fv1', visibility: ['public'], workspaceId: 'ws1' }]))
      .mockReturnValueOnce(selectChain([{ userId: 'system-user' }]));

    const req = {
      body: { formVersionId: 'fv1' },
      params: {},
      path: '/submissions',
    } as unknown as Request;
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await checkFormVisibility(req, res as Response, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(listGroupsForIdp).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });
});
