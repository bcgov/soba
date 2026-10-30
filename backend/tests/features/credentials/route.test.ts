jest.mock('../../../src/core/db/repos/formAccessRepo', () => ({
  resolveFormPermissions: jest.fn(),
}));
import { resolveFormPermissions } from '../../../src/core/db/repos/formAccessRepo';
import { Permissions } from '../../../src/core/db/codes';
import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../../src/core/errors';
jest.mock('../../../src/core/middleware/workspaceContext', () => ({
  workspaceFromResource:
    ({ kind }: { kind: string }) =>
    (req: Request, _res: Response, next: NextFunction) => {
      const role = req.headers['x-test-role'];
      if (typeof role !== 'string') return next(new ForbiddenError('Membership required'));
      req.coreContext = {
        workspaceId:
          kind === 'form' ? '01900000-0000-7000-8000-000000000001' : String(req.params.id),
        ...(kind === 'form' ? { formId: String(req.params.id) } : {}),
        actorId: 'actor',
        actorDisplayLabel: null,
        workspaceSource: 'workspace',
        role,
      };
      next();
    },
}));
jest.mock('../../../src/features/credentials/service', () => ({
  credentialService: {
    list: jest.fn(),
    issue: jest.fn(),
    regenerate: jest.fn(),
    updateNotes: jest.fn(),
  },
}));
import express from 'express';
import request from 'supertest';
import { buildOpenApiDocument } from '../../../src/core/api/shared/openapi';
import { registerCredentialsOpenApi } from '../../../src/features/credentials/schema';
import { credentialsRouter, formCredentialsRouter } from '../../../src/features/credentials/route';
import { credentialService } from '../../../src/features/credentials/service';
import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';
const query = { offset: 0, limit: 20, sort: 'createdAt:desc' as const, locale: 'en' as const };
const service = jest.mocked(credentialService);
const id = '01900000-0000-7000-8000-000000000001';
const credentialId = '01900000-0000-7000-8000-000000000002';
const path = `/workspaces/${id}/credentials`;
const app = express();
app.use(express.json());
app.use(credentialsRouter);
app.use('/design', formCredentialsRouter);
app.use(coreErrorHandler);
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(resolveFormPermissions).mockResolvedValue(new Set());
  service.list.mockResolvedValue({
    available: true,
    items: [],
    page: { offset: 0, limit: 20, total: 0 },
    filters: {},
    sort: 'createdAt:desc',
  });
});

describe('workspace credential routes', () => {
  it.each(['limit=101', 'offset=-1', 'cursor=old', 'sort=unsupported:asc', 'q=%20'])(
    'rejects invalid list queries: %s',
    async (params) => {
      expect((await request(app).get(`${path}?${params}`).set('x-test-role', 'admin')).status).toBe(
        400,
      );
      expect(service.list).not.toHaveBeenCalled();
    },
  );

  it('passes paging, search, sort and the preferred language to the list service', async () => {
    const response = await request(app)
      .get(`${path}?offset=10&limit=5&q=Vault&sort=label:asc&locale=en`)
      .set('x-test-role', 'admin')
      .set('Accept-Language', 'fr-CA');
    expect(response.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith(id, {
      offset: 10,
      limit: 5,
      q: 'Vault',
      sort: 'label:asc',
      locale: 'fr',
    });
    expect(response.headers.vary).toContain('Accept-Language');
  });
  const formId = '01900000-0000-7000-8000-000000000003';
  const formPath = `/design/forms/${formId}/credentials`;
  it('requires form update permission even for a workspace member', async () => {
    for (const operation of [request(app).get(formPath), request(app).post(formPath).send({})]) {
      const response = await operation.set('x-test-role', 'member');
      expect(response.status).toBe(403);
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(service.list).not.toHaveBeenCalled();
    expect(service.issue).not.toHaveBeenCalled();
  });
  it('allows a form manager to read and create only for the resolved form and workspace', async () => {
    jest.mocked(resolveFormPermissions).mockResolvedValue(new Set([Permissions.form_update]));
    expect((await request(app).get(formPath).set('x-test-role', 'member')).status).toBe(200);
    expect(service.list).toHaveBeenCalledWith(id, query, formId);
    const body = { label: 'Embedding', notes: '', types: ['api', 'web-component'] };
    const response = await request(app).post(formPath).set('x-test-role', 'member').send(body);
    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(service.issue).toHaveBeenCalledWith(id, 'actor', body, formId);
    expect(resolveFormPermissions).toHaveBeenCalledWith('actor', id, formId);
  });
  it('rejects caller-provided form ownership and invalid types', async () => {
    jest.mocked(resolveFormPermissions).mockResolvedValue(new Set([Permissions.form_update]));
    for (const body of [
      { label: 'Key', notes: '', types: ['api'], workspaceId: id },
      { label: 'Key', notes: '', types: ['api'], formId },
      { label: 'Key', notes: '', types: ['api', 'api'] },
    ]) {
      expect(
        (await request(app).post(formPath).set('x-test-role', 'member').send(body)).status,
      ).toBe(400);
    }
    expect(service.issue).not.toHaveBeenCalled();
  });

  it('saves notes through a workspace-scoped, non-cacheable PATCH', async () => {
    service.updateNotes.mockResolvedValue({
      id: credentialId,
      label: 'LABEL',
      types: ['api'],
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
    expect(service.list).not.toHaveBeenCalled();
  });
  it('documents all operations with bearer authentication and separate metadata/secret responses', () => {
    const document = buildOpenApiDocument([registerCredentialsOpenApi]);
    const resource = document.paths['/workspaces/{id}/credentials']!;
    expect(resource.get?.security).toEqual([{ bearerAuth: [] }]);
    expect(resource.post?.security).toEqual([{ bearerAuth: [] }]);
    expect(
      document.paths['/workspaces/{id}/credentials/{credentialId}/regenerate']?.post?.security,
    ).toEqual([{ bearerAuth: [] }]);
    expect(resource.get?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Credentials_CredentialState' },
        },
      },
    });
    expect(resource.post?.responses['201']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Credentials_CredentialSecret' },
        },
      },
    });
    expect(document.components?.schemas?.Credentials_CredentialSecret).toMatchObject({
      properties: { apiKey: { type: 'string' } },
    });
    expect(
      JSON.stringify(document.components?.schemas?.Credentials_CredentialMetadata),
    ).not.toContain('apiKey');
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
    expect(service.list).not.toHaveBeenCalled();
    expect(service.issue).not.toHaveBeenCalled();
    expect(service.regenerate).not.toHaveBeenCalled();
  });
  it.each(['owner', 'admin'])('allows %s to get metadata', async (role) => {
    expect((await request(app).get(path).set('x-test-role', role)).status).toBe(200);
    expect(service.list).toHaveBeenCalledWith(id, query);
  });
  it('rejects browser-provided upstream settings', async () => {
    const response = await request(app)
      .post(path)
      .set('x-test-role', 'owner')
      .send({ gatewayId: 'untrusted', aclGroups: ['admin'] });
    expect(response.status).toBe(400);
    expect(service.issue).not.toHaveBeenCalled();
  });
  it.each([
    { label: '', notes: '', types: ['api'] },
    { label: 'Key', notes: '', types: [] },
    { label: 'Key', notes: '', types: ['other'] },
    { label: 'Key', notes: '', types: ['api', 'api'] },
    { label: 'Key', notes: 'x'.repeat(1001), types: ['api'] },
  ])('rejects invalid create input %j', async (body) => {
    expect((await request(app).post(path).set('x-test-role', 'owner').send(body)).status).toBe(400);
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
        label: 'Integration',
        types: ['api' as const],
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
    const created = await request(app)
      .post(path)
      .set('x-test-role', 'owner')
      .send({ label: 'Integration', notes: '', types: ['api'] });
    expect(service.issue).toHaveBeenCalledWith(id, 'actor', {
      label: 'Integration',
      notes: '',
      types: ['api'],
    });
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
