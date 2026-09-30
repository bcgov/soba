import express from 'express';
import request from 'supertest';
import { z } from 'zod';

// Records what each route asks for. The real middleware resolves permissions from the database,
// which these tests are not about.
const mockPermissionCalls: string[][] = [];

jest.mock('../../../src/core/middleware/requireFormPermissions', () => ({
  requireFormPermissions: (required: readonly string[]) => {
    mockPermissionCalls.push([...required]);
    return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
  },
}));

import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';
import { NotFoundError } from '../../../src/core/errors';
import { Permissions } from '../../../src/core/db/codes';
import {
  settingsRoutes,
  type FormSettingsService,
} from '../../../src/features/form-settings/routes';

const BodySchema = z.object({ allowThing: z.boolean() });
type Body = z.infer<typeof BodySchema>;
type Settings = { allowThing: boolean };

const CONTEXT = { actorId: 'a1', workspaceId: 'ws1', actorDisplayLabel: 'Tester' };

const service = {
  get: jest.fn<Promise<Settings>, [unknown, string]>(),
  set: jest.fn<Promise<Settings>, [unknown, string, Body]>(),
};

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.coreContext = CONTEXT as unknown as NonNullable<typeof req.coreContext>;
  next();
});
app.use(
  '/forms/:id/settings/group',
  settingsRoutes(service as unknown as FormSettingsService<Settings, Body>, BodySchema),
);
app.use(coreErrorHandler);

describe('settingsRoutes', () => {
  beforeEach(() => {
    service.get.mockReset();
    service.set.mockReset();
  });

  it('gates the group on form_read and form_update', () => {
    expect(mockPermissionCalls).toEqual([[Permissions.form_read], [Permissions.form_update]]);
  });

  it('reads the group for the form in the request', async () => {
    service.get.mockResolvedValue({ allowThing: true });

    const res = await request(app).get('/forms/f1/settings/group');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ allowThing: true });
    expect(service.get).toHaveBeenCalledWith(CONTEXT, 'f1');
  });

  it('saves the validated body', async () => {
    service.set.mockResolvedValue({ allowThing: false });

    const res = await request(app).put('/forms/f1/settings/group').send({ allowThing: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ allowThing: false });
    expect(service.set).toHaveBeenCalledWith(CONTEXT, 'f1', { allowThing: false });
  });

  it('rejects a body the schema refuses without reaching the service', async () => {
    const res = await request(app).put('/forms/f1/settings/group').send({ allowThing: 'yes' });

    expect(res.status).toBe(400);
    expect(service.set).not.toHaveBeenCalled();
  });

  it('rejects a body missing a setting', async () => {
    const res = await request(app).put('/forms/f1/settings/group').send({});

    expect(res.status).toBe(400);
    expect(service.set).not.toHaveBeenCalled();
  });

  it('reports a missing row as 404', async () => {
    service.get.mockRejectedValue(new NotFoundError('Form settings not found'));

    const res = await request(app).get('/forms/f1/settings/group');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Form settings not found' });
  });
});
