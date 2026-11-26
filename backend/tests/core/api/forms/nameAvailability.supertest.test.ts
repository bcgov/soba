import express from 'express';
import request from 'supertest';

// Records what each route asks for, and refuses a request that carries x-deny. The real middleware
// resolves workspaces and permissions from the database, which these tests are not about.
const mockPermissionCalls: string[][] = [];

jest.mock('../../../../src/core/middleware/requireFormPermissions', () => {
  const { ForbiddenError } = jest.requireActual('../../../../src/core/errors');
  return {
    requireFormPermissions: (required: readonly string[]) => {
      mockPermissionCalls.push([...required]);
      return (req: express.Request, _res: express.Response, next: express.NextFunction) =>
        next(req.get('x-deny') ? new ForbiddenError('Insufficient form permissions') : undefined);
    },
  };
});

// A new form's check takes its workspace from the query; a rename's, and the form, from the path.
jest.mock('../../../../src/core/middleware/workspaceContext', () => {
  const pass = (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next();
  return {
    workspaceFromBody: pass,
    workspaceListScope: () => pass,
    workspaceFromQuery: (
      req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ) => {
      req.coreContext = { workspaceId: String(req.query.workspaceId) } as NonNullable<
        typeof req.coreContext
      >;
      next();
    },
    workspaceFromResource:
      () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.coreContext = { workspaceId: 'ws1', formId: req.params.id } as NonNullable<
          typeof req.coreContext
        >;
        next();
      },
  };
});

jest.mock('../../../../src/core/container', () => ({
  formsApiService: { checkNameAvailable: jest.fn(), getForm: jest.fn() },
}));

import { designFormsRouter } from '../../../../src/core/api/forms/route';
import { coreErrorHandler } from '../../../../src/core/middleware/errorHandler';
import { formsApiService } from '../../../../src/core/container';
import { FormCreatePermissions, Permissions } from '../../../../src/core/db/codes';

const checkNameAvailable = formsApiService.checkNameAvailable as jest.Mock;
const getForm = formsApiService.getForm as jest.Mock;

const FORM_ID = '01a11400-0000-7000-8000-000000000001';

const app = express();
app.use(express.json());
app.use(designFormsRouter);
app.use(coreErrorHandler);

beforeEach(() => {
  checkNameAvailable.mockReset().mockResolvedValue({ available: true });
  getForm.mockReset();
});

describe('GET /forms/name-availability', () => {
  it('asks for what creating a form asks for', () => {
    expect(mockPermissionCalls).toContainEqual([...FormCreatePermissions]);
  });

  it('checks the trimmed name in the queried workspace', async () => {
    checkNameAvailable.mockResolvedValue({ available: false });
    const res = await request(app)
      .get('/forms/name-availability')
      .query({ workspaceId: 'ws2', name: '  Permit  ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
    expect(checkNameAvailable).toHaveBeenCalledWith({ workspaceId: 'ws2' }, 'Permit');
  });

  it('is not read as a form id', async () => {
    await request(app).get('/forms/name-availability').query({ workspaceId: 'ws2', name: 'P' });
    expect(getForm).not.toHaveBeenCalled();
  });

  it.each([
    ['without a workspace', { name: 'Permit' }],
    ['with a blank name', { workspaceId: 'ws2', name: '  ' }],
  ])('refuses a check %s', async (_case, query) => {
    const res = await request(app).get('/forms/name-availability').query(query);
    expect(res.status).toBe(400);
    expect(checkNameAvailable).not.toHaveBeenCalled();
  });

  it('refuses a caller who could not create the form', async () => {
    const res = await request(app)
      .get('/forms/name-availability')
      .set('x-deny', 'true')
      .query({ workspaceId: 'ws2', name: 'Permit' });
    expect(res.status).toBe(403);
    expect(checkNameAvailable).not.toHaveBeenCalled();
  });
});

describe('GET /forms/:id/name-availability', () => {
  it('asks for what renaming the form asks for', () => {
    expect(mockPermissionCalls).toContainEqual([Permissions.form_update]);
  });

  it("checks the name in the form's workspace, with the form in context", async () => {
    const res = await request(app)
      .get(`/forms/${FORM_ID}/name-availability`)
      .query({ name: 'Permit' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: true });
    expect(checkNameAvailable).toHaveBeenCalledWith(
      { workspaceId: 'ws1', formId: FORM_ID },
      'Permit',
    );
  });

  it('refuses a caller who could not rename the form', async () => {
    const res = await request(app)
      .get(`/forms/${FORM_ID}/name-availability`)
      .set('x-deny', 'true')
      .query({ name: 'Permit' });
    expect(res.status).toBe(403);
    expect(checkNameAvailable).not.toHaveBeenCalled();
  });
});
