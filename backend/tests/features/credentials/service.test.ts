jest.mock('../../../src/core/logging', () => ({ log: { warn: jest.fn(), error: jest.fn() } }));
import { log } from '../../../src/core/logging';
jest.mock('../../../src/core/db/repos/workspaceCredentialRepo', () => ({
  getWorkspaceCredential: jest.fn(),
  listWorkspaceCredentials: jest.fn(),
  reserveWorkspaceCredential: jest.fn(),
  reserveCredentialRotation: jest.fn(),
  completeCredentialOperation: jest.fn(),
  markCredentialUnknown: jest.fn(),
  updateCredentialNotes: jest.fn(),
}));
jest.mock('../../../src/core/integrations/credential-issuer/CredentialIssuerRegistry', () => ({
  createCredentialIssuerAdapter: jest.fn(),
  resolveDefaultCredentialIssuerCode: jest.fn(),
}));
import { CredentialService } from '../../../src/features/credentials/service';
import * as repo from '../../../src/core/db/repos/workspaceCredentialRepo';
import * as registry from '../../../src/core/integrations/credential-issuer/CredentialIssuerRegistry';

const mockedRepo = jest.mocked(repo);
const mockedRegistry = jest.mocked(registry);
const query = { offset: 0, limit: 20, sort: 'createdAt:desc' as const, locale: 'en' as const };
const service = new CredentialService();
const issued = {
  clientId: 'consumer',
  apiKey: 'never-store-this',
  flow: 'kong-api-key-only' as const,
};
const record: repo.CredentialRecord = {
  id: 'credential',
  workspaceId: 'workspace',
  formId: null,
  issuerCode: 'original-issuer',
  clientId: null,
  flow: null,
  label: 'Integration',
  types: ['api', 'web-component'],
  notes: '',
  status: 'issuing',
  createdBy: 'actor',
  updatedBy: 'actor',
  createdAt: new Date(),
  updatedAt: new Date(),
  rotatedAt: null,
};
const input = {
  label: 'Integration',
  notes: '',
  types: ['api', 'web-component'] as ('api' | 'web-component')[],
};
const adapter = { issue: jest.fn(), regenerate: jest.fn() };
beforeEach(() => {
  jest.resetAllMocks();
  mockedRegistry.resolveDefaultCredentialIssuerCode.mockReturnValue('new-default');
  mockedRegistry.createCredentialIssuerAdapter.mockReturnValue(adapter);
  mockedRepo.reserveWorkspaceCredential.mockResolvedValue(record);
  mockedRepo.markCredentialUnknown.mockResolvedValue();
  mockedRepo.completeCredentialOperation.mockResolvedValue({
    ...record,
    clientId: issued.clientId,
    flow: issued.flow,
    status: 'active',
  });
  adapter.issue.mockResolvedValue(issued);
  adapter.regenerate.mockResolvedValue(issued);
});

describe('workspace credential service', () => {
  it('creates multiple form keys with multiple types and trusted form identity', async () => {
    mockedRepo.reserveWorkspaceCredential.mockResolvedValue({ ...record, formId: 'form' });
    await service.issue('workspace', 'actor', input, 'form');
    await service.issue('workspace', 'actor', input, 'form');
    expect(mockedRepo.reserveWorkspaceCredential).toHaveBeenCalledTimes(2);
    expect(mockedRepo.reserveWorkspaceCredential).toHaveBeenCalledWith(
      'workspace',
      'new-default',
      'actor',
      input,
      'form',
    );
    expect(adapter.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: expect.objectContaining({ 'workspace-id': 'workspace', 'form-id': 'form' }),
      }),
    );
  });
  it('reads only the requested form collection', async () => {
    mockedRepo.listWorkspaceCredentials.mockResolvedValue({
      items: [{ ...record, formId: 'form' }],
      total: 1,
    });
    expect((await service.list('workspace', query, 'form')).items).toHaveLength(1);
    expect(mockedRepo.listWorkspaceCredentials).toHaveBeenCalledWith('workspace', query, 'form');
  });

  it('reports a failed reconciliation write without exposing either error or retrying issuance', async () => {
    adapter.issue.mockRejectedValue(new Error('upstream secret'));
    mockedRepo.markCredentialUnknown.mockRejectedValue(new Error('database secret'));
    await expect(service.issue('workspace', 'actor', input)).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining('administrator must reconcile'),
    });
    expect(log.error).toHaveBeenCalledWith(
      {
        credentialId: record.id,
        workspaceId: record.workspaceId,
        issuerCode: record.issuerCode,
        operation: 'issue',
        stage: 'reconciliation',
      },
      expect.any(String),
    );
    expect(adapter.issue).toHaveBeenCalledTimes(1);
    expect(mockedRepo.completeCredentialOperation).not.toHaveBeenCalled();
    const diagnostics = JSON.stringify([
      ...jest.mocked(log.warn).mock.calls,
      ...jest.mocked(log.error).mock.calls,
    ]);
    expect(diagnostics).not.toContain('upstream secret');
    expect(diagnostics).not.toContain('database secret');
  });

  it('updates notes within the workspace without calling the issuer', async () => {
    mockedRepo.updateCredentialNotes.mockResolvedValue({ ...record, notes: 'Vault reference' });
    const result = await service.updateNotes('workspace', 'credential', 'actor', 'Vault reference');
    expect(mockedRepo.updateCredentialNotes).toHaveBeenCalledWith(
      'workspace',
      'credential',
      'actor',
      'Vault reference',
      null,
    );
    expect(result.notes).toBe('Vault reference');
    expect(adapter.issue).not.toHaveBeenCalled();
    expect(adapter.regenerate).not.toHaveBeenCalled();
  });
  it('does not save notes to a credential outside the workspace', async () => {
    mockedRepo.updateCredentialNotes.mockResolvedValue(null);
    await expect(
      service.updateNotes('other-workspace', 'credential', 'actor', 'notes'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('reserves a record before issuing, constructs trusted metadata, and returns the key once', async () => {
    const result = await service.issue('workspace', 'actor', input);
    expect(mockedRepo.reserveWorkspaceCredential).toHaveBeenCalledWith(
      'workspace',
      'new-default',
      'actor',
      input,
      null,
    );
    expect(mockedRepo.reserveWorkspaceCredential.mock.invocationCallOrder[0]).toBeLessThan(
      adapter.issue.mock.invocationCallOrder[0],
    );
    expect(adapter.issue).toHaveBeenCalledWith({
      applicationName: 'soba-workspace-workspace-credential',
      labels: { 'issued-by': 'soba', 'workspace-id': 'workspace', 'credential-id': 'credential' },
    });
    expect(result.apiKey).toBe(issued.apiKey);
    expect(result.credential).not.toHaveProperty('clientId');
    expect(result.credential).not.toHaveProperty('apiKey');
  });
  it('uses independent upstream identities for keys in the same workspace', async () => {
    mockedRepo.reserveWorkspaceCredential
      .mockResolvedValueOnce(record)
      .mockResolvedValueOnce({ ...record, id: 'second' });
    await service.issue('workspace', 'actor', input);
    await service.issue('workspace', 'actor', input);
    expect(adapter.issue.mock.calls.map(([request]) => request.applicationName)).toEqual([
      'soba-workspace-workspace-credential',
      'soba-workspace-workspace-second',
    ]);
  });
  it('does not call the issuer when reservation fails', async () => {
    mockedRepo.reserveWorkspaceCredential.mockResolvedValue(null);
    await expect(service.issue('workspace', 'actor', input)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(adapter.issue).not.toHaveBeenCalled();
  });
  it('does not reserve a record when the no-op is selected', async () => {
    mockedRegistry.resolveDefaultCredentialIssuerCode.mockReturnValue('credential-issuer-noop');
    await expect(service.issue('workspace', 'actor', input)).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(mockedRepo.reserveWorkspaceCredential).not.toHaveBeenCalled();
  });
  it('returns metadata without upstream identifiers or secrets', async () => {
    mockedRepo.listWorkspaceCredentials.mockResolvedValue({
      items: [
        { ...record, clientId: 'consumer' },
        { ...record, id: 'second' },
      ],
      total: 2,
    });
    const result = await service.list('workspace', query);
    expect(result.available).toBe(true);
    expect(JSON.stringify(result)).not.toContain('consumer');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject(input);
    expect(result.items[0]).not.toHaveProperty('issuerCode');
  });
  it('reports unavailable configuration without exposing details', async () => {
    mockedRepo.listWorkspaceCredentials.mockResolvedValue({ items: [], total: 0 });
    mockedRegistry.createCredentialIssuerAdapter.mockImplementation(() => {
      throw new Error('private config details');
    });
    expect(await service.list('workspace', query)).toEqual({
      available: false,
      items: [],
      page: { offset: 0, limit: 20, total: 0 },
      filters: {},
      sort: 'createdAt:desc',
    });
  });
  it('does not rotate a credential owned by another workspace', async () => {
    mockedRepo.getWorkspaceCredential.mockResolvedValue(null);
    await expect(
      service.regenerate('other-workspace', 'credential', 'actor'),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(adapter.regenerate).not.toHaveBeenCalled();
  });
  it('uses the recorded issuer and client id, rather than the current default', async () => {
    const active = { ...record, status: 'active' as const, clientId: 'stored-consumer' };
    mockedRepo.getWorkspaceCredential.mockResolvedValue(active);
    mockedRepo.reserveCredentialRotation.mockResolvedValue({ ...active, status: 'rotating' });
    await service.regenerate('workspace', 'credential', 'actor');
    expect(mockedRegistry.createCredentialIssuerAdapter).toHaveBeenCalledWith('original-issuer');
    expect(mockedRepo.getWorkspaceCredential).toHaveBeenCalledWith('workspace', 'credential', null);
    expect(adapter.regenerate).toHaveBeenCalledWith('stored-consumer');
  });
  it('refuses a concurrent rotation', async () => {
    mockedRepo.getWorkspaceCredential.mockResolvedValue({
      ...record,
      status: 'active',
      clientId: 'consumer',
    });
    mockedRepo.reserveCredentialRotation.mockResolvedValue(null);
    await expect(service.regenerate('workspace', 'credential', 'actor')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(adapter.regenerate).not.toHaveBeenCalled();
  });
  it.each(['issuing', 'rotating', 'unknown'] as const)(
    'blocks regeneration of a %s record',
    async (status) => {
      mockedRepo.getWorkspaceCredential.mockResolvedValue({
        ...record,
        status,
        clientId: 'consumer',
      });
      await expect(service.regenerate('workspace', 'credential', 'actor')).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(mockedRepo.reserveCredentialRotation).not.toHaveBeenCalled();
    },
  );
  it.each(['upstream', 'persistence'])(
    'retains the reservation after an uncertain %s failure and never retries',
    async (failure) => {
      if (failure === 'upstream')
        adapter.issue.mockRejectedValue(
          Object.assign(new Error('secret upstream body'), { upstreamStatus: 502 }),
        );
      else
        mockedRepo.completeCredentialOperation.mockRejectedValue(new Error('database unavailable'));
      await expect(service.issue('workspace', 'actor', input)).rejects.toMatchObject({
        statusCode: 503,
        message: expect.not.stringContaining('secret upstream body'),
      });
      expect(mockedRepo.markCredentialUnknown).toHaveBeenCalledWith(record, 'actor');
      expect(adapter.issue).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        {
          credentialId: record.id,
          workspaceId: record.workspaceId,
          issuerCode: record.issuerCode,
          operation: 'issue',
          stage: failure,
          upstreamStatus: failure === 'upstream' ? 502 : undefined,
        },
        expect.any(String),
      );
      expect(JSON.stringify(jest.mocked(log.warn).mock.calls)).not.toContain(
        'secret upstream body',
      );
      expect(JSON.stringify(jest.mocked(log.warn).mock.calls)).not.toContain(
        'database unavailable',
      );
      expect(JSON.stringify(jest.mocked(log.warn).mock.calls)).not.toContain(issued.apiKey);
    },
  );
});
