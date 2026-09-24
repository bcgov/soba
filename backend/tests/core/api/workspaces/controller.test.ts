import { getEngineTenants, getEngineHealth } from '../../../../src/core/api/workspaces/controller';
import { TenantService } from '../../../../src/core/services/tenantService';
import { ValidationError } from '../../../../src/core/errors';

jest.mock('../../../../src/core/services/tenantService');
jest.mock('../../../../src/core/middleware/actor', () => ({
  getActorId: (req: import('express').Request & { coreContext?: { actorId?: string } }) =>
    req.coreContext?.actorId,
  getActorIdpCode: (req: import('express').Request & { coreContext?: { actorIdpCode?: string } }) =>
    req.coreContext?.actorIdpCode,
}));

describe('Workspaces Controller', () => {
  let req: import('express').Request & { user?: unknown };
  let res: import('express').Response;
  let next: jest.Mock;
  let mockList: jest.Mock;
  let mockHealth: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: { idpAttributes: { idir_user_guid: 'user-1' } },
      headers: { authorization: 'Bearer token' },
      params: {},
    } as unknown as import('express').Request & { user?: unknown };

    res = {
      json: jest.fn(),
    } as unknown as import('express').Response;

    next = jest.fn();

    mockList = jest.fn().mockResolvedValue({ tenants: [{ id: 't1' }] });
    mockHealth = jest.fn().mockResolvedValue({ ok: true });

    (TenantService as jest.Mock).mockImplementation(() => ({
      list: mockList,
      health: mockHealth,
    }));
  });

  it('getEngineTenants throws ValidationError if userId is missing', async () => {
    req = { user: { idpAttributes: {} } } as unknown as import('express').Request & {
      user?: unknown;
    };
    await getEngineTenants(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Couldn't determine user id" }),
    );
  });

  it('getEngineTenants returns tenants from TenantService (idir)', async () => {
    await getEngineTenants(req, res, next);
    expect(mockList).toHaveBeenCalledWith({
      userId: 'user-1',
      token: 'Bearer token',
    });
    expect(res.json).toHaveBeenCalledWith({ tenants: [{ id: 't1' }] });
  });

  it('getEngineTenants returns tenants from TenantService (bceid)', async () => {
    req = {
      user: { idpAttributes: { bceid_user_guid: 'user-bceid' } },
      headers: { authorization: 'Bearer token' },
      params: {},
    } as unknown as import('express').Request & { user?: unknown };

    await getEngineTenants(req, res, next);
    expect(mockList).toHaveBeenCalledWith({
      userId: 'user-bceid',
      token: 'Bearer token',
    });
    expect(res.json).toHaveBeenCalledWith({ tenants: [{ id: 't1' }] });
  });

  it('getEngineTenants passes engineCode if provided in params', async () => {
    req.params = { engineCode: 'custom-engine' };

    await getEngineTenants(req, res, next);
    expect(mockList).toHaveBeenCalledWith({
      userId: 'user-1',
      token: 'Bearer token',
      tenantEngineCode: 'custom-engine',
    });
  });

  it('getEngineHealth returns health from TenantService', async () => {
    await getEngineHealth(req, res, next);
    expect(mockHealth).toHaveBeenCalledWith({});
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('getEngineHealth passes engineCode if provided in params', async () => {
    req.params = { engineCode: 'custom-engine' };
    await getEngineHealth(req, res, next);
    expect(mockHealth).toHaveBeenCalledWith({
      tenantEngineCode: 'custom-engine',
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
