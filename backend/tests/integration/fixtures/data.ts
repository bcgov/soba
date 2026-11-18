import type { CredentialRecord } from '../../../src/core/db/repos/workspaceCredentialRepo';
import type { SubmissionRecord } from '../../../src/features/submission-export/engineSource';
import type { ExportRow } from '../../../src/features/submission-export/source';

export const testIds = {
  credential: '00000000-0000-4000-8000-000000000001',
  workspace: '00000000-0000-4000-8000-000000000002',
  form: '00000000-0000-4000-8000-000000000003',
  creator: '00000000-0000-4000-8000-000000000004',
  version: '00000000-0000-4000-8000-000000000005',
  submission: '00000000-0000-4000-8000-000000000006',
  otherForm: '00000000-0000-4000-8000-000000000007',
  otherWorkspace: '00000000-0000-4000-8000-000000000008',
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
  permissions: ['submission_read'],
  ...overrides,
});

export const submissionFixture = (overrides: Partial<SubmissionRecord> = {}): SubmissionRecord => ({
  submissionId: testIds.submission,
  confirmationCode: 'ABC12345',
  versionId: testIds.version,
  submittedAt: '2026-01-01T00:00:00Z',
  submitter: 'tester',
  username: 'tester',
  email: '',
  engineSchemaRef: 'schema',
  engineSubmissionRef: 'document',
  ...overrides,
});

export const exportRowFixture = (overrides: Partial<ExportRow> = {}): ExportRow => ({
  submissionId: testIds.submission,
  confirmationCode: 'ABC12345',
  versionId: testIds.version,
  submittedAt: '2026-01-01T00:00:00Z',
  submitter: 'tester',
  username: 'tester',
  email: '',
  answers: { answer: 'hello, world' },
  ...overrides,
});
