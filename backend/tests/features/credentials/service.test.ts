jest.mock('../../../src/core/db/repos/workspaceCredentialRepo', () => ({
  getWorkspaceCredential: jest.fn(),
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
import { WorkspaceCredentialService } from '../../../src/features/credentials/service';
import * as repo from '../../../src/core/db/repos/workspaceCredentialRepo';
import * as registry from '../../../src/core/integrations/credential-issuer/CredentialIssuerRegistry';

const mockedRepo = jest.mocked(repo);
const mockedRegistry = jest.mocked(registry);
const service = new WorkspaceCredentialService();
const issued = {
  clientId: 'consumer',
  apiKey: 'never-store-this',
  flow: 'kong-api-key-only' as const,
};
const record: repo.CredentialRecord = {
  id: 'credential',
  workspaceId: 'workspace',
  issuerCode: 'original-issuer',
  clientId: null,
  flow: null,
  notes: '',
  status: 'issuing',
  createdBy: 'actor',
  updatedBy: 'actor',
  createdAt: new Date(),
  updatedAt: new Date(),
  rotatedAt: null,
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
  it('updates notes within the workspace without calling the issuer', async () => {
    mockedRepo.updateCredentialNotes.mockResolvedValue({ ...record, notes: 'Vault reference' });
    const result = await service.updateNotes('workspace', 'credential', 'actor', 'Vault reference');
    expect(mockedRepo.updateCredentialNotes).toHaveBeenCalledWith(
      'workspace',
      'credential',
      'actor',
      'Vault reference',
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

  it('reserves the slot before issuing, constructs trusted metadata, and returns the key once', async () => {
    const result = await service.issue('workspace', 'actor');
    expect(mockedRepo.reserveWorkspaceCredential).toHaveBeenCalledWith(
      'workspace',
      'new-default',
      'actor',
    );
    expect(mockedRepo.reserveWorkspaceCredential.mock.invocationCallOrder[0]).toBeLessThan(
      adapter.issue.mock.invocationCallOrder[0],
    );
    expect(adapter.issue).toHaveBeenCalledWith({
      applicationName: 'soba-workspace-workspace',
      labels: { 'issued-by': 'soba', 'workspace-id': 'workspace' },
    });
    expect(result.apiKey).toBe(issued.apiKey);
    expect(result.credential).not.toHaveProperty('clientId');
    expect(result.credential).not.toHaveProperty('apiKey');
  });
  it('does not issue when another request has reserved the workspace', async () => {
    mockedRepo.reserveWorkspaceCredential.mockResolvedValue(null);
    await expect(service.issue('workspace', 'actor')).rejects.toMatchObject({ statusCode: 409 });
    expect(adapter.issue).not.toHaveBeenCalled();
  });
  it('does not reserve a slot when the no-op is selected', async () => {
    mockedRegistry.resolveDefaultCredentialIssuerCode.mockReturnValue('credential-issuer-noop');
    await expect(service.issue('workspace', 'actor')).rejects.toMatchObject({ statusCode: 503 });
    expect(mockedRepo.reserveWorkspaceCredential).not.toHaveBeenCalled();
  });
  it('returns metadata without upstream identifiers or secrets', async () => {
    mockedRepo.getWorkspaceCredential.mockResolvedValue({ ...record, clientId: 'consumer' });
    const result = await service.get('workspace');
    expect(result.available).toBe(true);
    expect(JSON.stringify(result)).not.toContain('consumer');
    expect(result.credential).not.toHaveProperty('issuerCode');
  });
  it('reports unavailable configuration without exposing details', async () => {
    mockedRepo.getWorkspaceCredential.mockResolvedValue(null);
    mockedRegistry.createCredentialIssuerAdapter.mockImplementation(() => {
      throw new Error('private config details');
    });
    expect(await service.get('workspace')).toEqual({ available: false, credential: null });
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
        adapter.issue.mockRejectedValue(new Error('secret upstream body'));
      else
        mockedRepo.completeCredentialOperation.mockRejectedValue(new Error('database unavailable'));
      await expect(service.issue('workspace', 'actor')).rejects.toMatchObject({
        statusCode: 503,
        message: expect.not.stringContaining('secret upstream body'),
      });
      expect(mockedRepo.markCredentialUnknown).toHaveBeenCalledWith(record, 'actor');
      expect(adapter.issue).toHaveBeenCalledTimes(1);
    },
  );
});
