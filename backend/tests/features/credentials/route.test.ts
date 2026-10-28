import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../../src/core/errors';
jest.mock('../../../src/core/middleware/workspaceContext', () => ({
  workspaceFromResource: () => (req: Request, _res: Response, next: NextFunction) => {
    const role = req.headers['x-test-role'];
    if (typeof role !== 'string') return next(new ForbiddenError('Membership required'));
    req.coreContext = {
      workspaceId: String(req.params.id),
      actorId: 'actor',
      actorDisplayLabel: null,
      workspaceSource: 'workspace',
      role,
    };
    next();
  },
}));
jest.mock('../../../src/features/credentials/service', () => ({
  workspaceCredentialService: {
    get: jest.fn(),
    issue: jest.fn(),
    regenerate: jest.fn(),
    updateNotes: jest.fn(),
  },
}));
import express from 'express';
import request from 'supertest';
import { buildOpenApiDocument } from '../../../src/core/api/shared/openapi';
import { registerCredentialsOpenApi } from '../../../src/features/credentials/schema';
import { credentialsRouter } from '../../../src/features/credentials/route';
import { workspaceCredentialService } from '../../../src/features/credentials/service';
import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';
const service = jest.mocked(workspaceCredentialService);
const id = '01900000-0000-7000-8000-000000000001';
const credentialId = '01900000-0000-7000-8000-000000000002';
const path = `/workspaces/${id}/credentials`;
const app = express();
app.use(express.json());
app.use(credentialsRouter);
app.use(coreErrorHandler);
beforeEach(() => {
  jest.clearAllMocks();
  service.get.mockResolvedValue({ available: true, credential: null });
});

describe('workspace credential routes', () => {
  it('saves notes through a workspace-scoped, non-cacheable PATCH', async () => {
    service.updateNotes.mockResolvedValue({
      id: credentialId,
      label: 'LABEL',
      notes: 'Vault reference',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rotatedAt: null,
    });
    const response = await request(app)
      .patch(`${path}/${credentialId}`)
      .set('x-test-role', 'admin')
      .send({ notes: 'Vault reference' });
    expect(response.status).toBe(200);
    expect(service.updateNotes).toHaveBeenCalledWith(id, credentialId, 'actor', 'Vault reference');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).not.toHaveProperty('apiKey');
  });
  it('rejects oversized notes and unknown fields', async () => {
    for (const body of [{ notes: 'x'.repeat(1001) }, { notes: 'note', clientId: 'untrusted' }]) {
      const response = await request(app)
        .patch(`${path}/${credentialId}`)
        .set('x-test-role', 'owner')
        .send(body);
      expect(response.status).toBe(400);
    }
    expect(service.updateNotes).not.toHaveBeenCalled();
  });

  it('requires workspace membership before reaching the service', async () => {
    expect((await request(app).get(path)).status).toBe(403);
    expect(service.get).not.toHaveBeenCalled();
  });
  it('documents all operations with bearer authentication and separate metadata/secret responses', () => {
    const document = buildOpenApiDocument([registerCredentialsOpenApi]);
    const resource = document.paths['/workspaces/{id}/credentials']!;
    expect(resource.get?.security).toEqual([{ bearerAuth: [] }]);
    expect(resource.post?.security).toEqual([{ bearerAuth: [] }]);
    expect(
      document.paths['/workspaces/{id}/credentials/{credentialId}/regenerate']?.post?.security,
    ).toEqual([{ bearerAuth: [] }]);
    expect(JSON.stringify(resource.get?.responses['200'])).not.toContain('apiKey');
    expect(JSON.stringify(resource.post?.responses['201'])).toContain('apiKey');
  });

  it.each(['member', 'viewer', 'submitter'])('denies %s on all operations', async (role) => {
    for (const operation of [
      request(app).get(path),
      request(app).post(path).send({}),
      request(app).post(`${path}/${credentialId}/regenerate`).send({}),
      request(app).patch(`${path}/${credentialId}`).send({ notes: 'note' }),
    ]) {
      const response = await operation.set('x-test-role', role);
      expect(response.status).toBe(403);
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(service.get).not.toHaveBeenCalled();
    expect(service.issue).not.toHaveBeenCalled();
    expect(service.regenerate).not.toHaveBeenCalled();
  });
  it.each(['owner', 'admin'])('allows %s to get metadata', async (role) => {
    expect((await request(app).get(path).set('x-test-role', role)).status).toBe(200);
    expect(service.get).toHaveBeenCalledWith(id);
  });
  it('rejects browser-provided upstream settings', async () => {
    const response = await request(app)
      .post(path)
      .set('x-test-role', 'owner')
      .send({ gatewayId: 'untrusted', aclGroups: ['admin'] });
    expect(response.status).toBe(400);
    expect(service.issue).not.toHaveBeenCalled();
  });
  it('validates workspace and credential UUIDs', async () => {
    expect(
      (await request(app).get('/workspaces/bad/credentials').set('x-test-role', 'admin')).status,
    ).toBe(400);
    expect(
      (await request(app).post(`${path}/bad/regenerate`).set('x-test-role', 'admin').send({}))
        .status,
    ).toBe(400);
    expect(service.regenerate).not.toHaveBeenCalled();
  });
  it('returns a non-cacheable secret only on successful create/rotate responses', async () => {
    const result = {
      credential: {
        id: credentialId,
        label: credentialId.toUpperCase(),
        notes: '',
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rotatedAt: null,
      },
      apiKey: 'one-time-secret',
    };
    service.issue.mockResolvedValue(result);
    service.regenerate.mockResolvedValue(result);
    const created = await request(app).post(path).set('x-test-role', 'owner').send({});
    expect(created.status).toBe(201);
    expect(created.body.apiKey).toBe('one-time-secret');
    expect(created.headers['cache-control']).toBe('no-store');
    const rotated = await request(app)
      .post(`${path}/${credentialId}/regenerate`)
      .set('x-test-role', 'admin')
      .send({});
    expect(rotated.status).toBe(200);
    expect(service.regenerate).toHaveBeenCalledWith(id, credentialId, 'actor');
    expect((await request(app).get(path).set('x-test-role', 'owner')).body).not.toHaveProperty(
      'apiKey',
    );
  });
});
