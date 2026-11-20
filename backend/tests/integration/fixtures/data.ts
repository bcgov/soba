import type { CredentialRecord } from '../../../src/core/db/repos/workspaceCredentialRepo';

const testIds = {
  credential: '00000000-0000-4000-8000-000000000001',
  workspace: '00000000-0000-4000-8000-000000000002',
  creator: '00000000-0000-4000-8000-000000000004',
};

/** Complete records keep tests sensitive to changes in the repository's return type. */
export const credentialFixture = (overrides: Partial<CredentialRecord> = {}): CredentialRecord => ({
  id: testIds.credential,
  workspaceId: testIds.workspace,
  formId: null,
  issuerCode: 'aps',
  clientId: 'client',
  flow: 'kong-api-key-acl',
  label: 'Test integration',
  notes: '',
  status: 'active',
  createdBy: testIds.creator,
  updatedBy: testIds.creator,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  rotatedAt: null,
  deletedAt: null,
  deletedBy: null,
  types: ['api'],
  ...overrides,
});
