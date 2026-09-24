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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getEngineTenants throws ValidationError if userId is missing', async () => {
    const req = { user: { idpAttributes: {} } } as unknown as import('express').Request;
    const res = {} as unknown as import('express').Response;
    const next = jest.fn();

    await getEngineTenants(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Couldn't determine user id" }),
    );
  });

  it('getEngineTenants returns tenants from TenantService (idir)', async () => {
    const req = {
      user: { idpAttributes: { idir_user_guid: 'user-1' } },
      headers: { authorization: 'Bearer token' },
      params: {},
    } as unknown as import('express').Request;
    const res = {
      json: jest.fn(),
    } as unknown as import('express').Response;

    const mockList = jest.fn().mockResolvedValue({ tenants: [{ id: 't1' }] });
    (TenantService as jest.Mock).mockImplementation(() => ({
      list: mockList,
    }));

    await getEngineTenants(req, res, jest.fn());

    expect(mockList).toHaveBeenCalledWith({
      userId: 'user-1',
      token: 'Bearer token',
    });
    expect(res.json).toHaveBeenCalledWith({ tenants: [{ id: 't1' }] });
  });

  it('getEngineTenants returns tenants from TenantService (bceid)', async () => {
    const req = {
      user: { idpAttributes: { bceid_user_guid: 'user-bceid' } },
      headers: { authorization: 'Bearer token' },
      params: {},
    } as unknown as import('express').Request;
    const res = {
      json: jest.fn(),
    } as unknown as import('express').Response;

    const mockList = jest.fn().mockResolvedValue({ tenants: [{ id: 't1' }] });
    (TenantService as jest.Mock).mockImplementation(() => ({
      list: mockList,
    }));

    await getEngineTenants(req, res, jest.fn());

    expect(mockList).toHaveBeenCalledWith({
      userId: 'user-bceid',
      token: 'Bearer token',
    });
    expect(res.json).toHaveBeenCalledWith({ tenants: [{ id: 't1' }] });
  });

  it('getEngineTenants passes engineCode if provided in params', async () => {
    const req = {
      user: { idpAttributes: { idir_user_guid: 'user-1' } },
      headers: { authorization: 'Bearer token' },
      params: { engineCode: 'custom-engine' },
    } as unknown as import('express').Request;
    const res = {
      json: jest.fn(),
    } as unknown as import('express').Response;

    const mockList = jest.fn().mockResolvedValue({ tenants: [] });
    (TenantService as jest.Mock).mockImplementation(() => ({
      list: mockList,
    }));

    await getEngineTenants(req, res, jest.fn());

    expect(mockList).toHaveBeenCalledWith({
      userId: 'user-1',
      token: 'Bearer token',
      tenantEngineCode: 'custom-engine',
    });
  });
  it('getEngineHealth returns health from TenantService', async () => {
    const req = {
      params: {},
    } as unknown as import('express').Request;
    const res = {
      json: jest.fn(),
    } as unknown as import('express').Response;

    const mockHealth = jest.fn().mockResolvedValue({ ok: true });
    (TenantService as jest.Mock).mockImplementation(() => ({
      health: mockHealth,
    }));

    await getEngineHealth(req, res, jest.fn());

    expect(mockHealth).toHaveBeenCalledWith({});
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('getEngineHealth passes engineCode if provided in params', async () => {
    const req = {
      params: { engineCode: 'custom-engine' },
    } as unknown as import('express').Request;
    const res = {
      json: jest.fn(),
    } as unknown as import('express').Response;

    const mockHealth = jest.fn().mockResolvedValue({ ok: true });
    (TenantService as jest.Mock).mockImplementation(() => ({
      health: mockHealth,
    }));

    await getEngineHealth(req, res, jest.fn());

    expect(mockHealth).toHaveBeenCalledWith({
      tenantEngineCode: 'custom-engine',
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
