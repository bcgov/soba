import type {
  CreateCredential,
  CredentialMetadata,
  CredentialSecret,
  CredentialState,
} from '@soba/lib';
import { ConflictError, NotFoundError, ServiceUnavailableError } from '../../core/errors';
import {
  createCredentialIssuerAdapter,
  resolveDefaultCredentialIssuerCode,
} from '../../core/integrations/credential-issuer/CredentialIssuerRegistry';
import type {
  CredentialIssuerAdapter,
  IssuedApiKey,
} from '../../core/integrations/credential-issuer/CredentialIssuerAdapter';
import type { CredentialListQuery } from './schema';
import * as repo from '../../core/db/repos/workspaceCredentialRepo';
import { failCredentialOperation, type CredentialOperationStage } from './operationFailure';

export const credentialMetadata = (record: repo.CredentialRecord): CredentialMetadata => ({
  id: record.id,
  label: record.label,
  types: record.types,
  notes: record.notes,
  status: record.status,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
  rotatedAt: record.rotatedAt?.toISOString() ?? null,
});

const configuredIssuer = (code: string): CredentialIssuerAdapter => {
  if (code === 'credential-issuer-noop')
    throw new ServiceUnavailableError('Credential issuance is unavailable');
  try {
    return createCredentialIssuerAdapter(code);
  } catch {
    throw new ServiceUnavailableError('Credential issuer is not configured');
  }
};

export class CredentialService {
  async list(
    workspaceId: string,
    query: CredentialListQuery,
    formId: string | null = null,
  ): Promise<CredentialState> {
    const { items, total } = await repo.listWorkspaceCredentials(workspaceId, query, formId);
    let available = false;
    try {
      configuredIssuer(resolveDefaultCredentialIssuerCode());
      available = true;
    } catch {
      /* Unavailable issuer is reported without exposing configuration. */
    }
    return {
      available,
      items: items.map(credentialMetadata),
      page: { offset: query.offset, limit: query.limit, total },
      filters: { q: query.q },
      sort: query.sort,
    };
  }

  async issue(
    workspaceId: string,
    actorId: string,
    input: CreateCredential,
    formId: string | null = null,
  ): Promise<CredentialSecret> {
    const issuerCode = resolveDefaultCredentialIssuerCode();
    const issuer = configuredIssuer(issuerCode);
    const record = await repo.reserveWorkspaceCredential(
      workspaceId,
      issuerCode,
      actorId,
      {
        label: input.label,
        notes: input.notes,
        types: input.types,
      },
      formId,
    );
    if (!record) throw new ConflictError('Credential could not be reserved');
    return this.perform(record, actorId, () =>
      issuer.issue({
        applicationName: `soba-workspace-${workspaceId}-${record.id}`,
        labels: {
          'issued-by': 'soba',
          'workspace-id': workspaceId,
          'credential-id': record.id,
          ...(formId ? { 'form-id': formId } : {}),
        },
      }),
    );
  }

  async regenerate(
    workspaceId: string,
    id: string,
    actorId: string,
    formId: string | null = null,
  ): Promise<CredentialSecret> {
    const existing = await repo.getWorkspaceCredential(workspaceId, id, formId);
    if (existing?.id !== id) throw new NotFoundError('Credential not found');
    if (existing.status !== 'active' || !existing.clientId)
      throw new ConflictError('Credential operation is pending or requires reconciliation');
    const issuer = configuredIssuer(existing.issuerCode);
    const record = await repo.reserveCredentialRotation(workspaceId, id, actorId, formId);
    if (!record) throw new ConflictError('Another credential operation has started');
    const clientId = existing.clientId;
    return this.perform(record, actorId, () => issuer.regenerate(clientId));
  }

  async updateNotes(
    workspaceId: string,
    id: string,
    actorId: string,
    notes: string,
    formId: string | null = null,
  ): Promise<CredentialMetadata> {
    const record = await repo.updateCredentialNotes(workspaceId, id, actorId, notes, formId);
    if (!record) throw new NotFoundError('Credential not found');
    return credentialMetadata(record);
  }

  private async perform(
    record: repo.CredentialRecord,
    actorId: string,
    operation: () => Promise<IssuedApiKey>,
  ): Promise<CredentialSecret> {
    let stage: CredentialOperationStage = 'upstream';
    try {
      const issued = await operation();
      stage = 'persistence';
      const saved = await repo.completeCredentialOperation(record, actorId, issued);
      return { credential: credentialMetadata(saved), apiKey: issued.apiKey };
    } catch (error) {
      return failCredentialOperation(record, actorId, stage, error);
    }
  }
}
export const credentialService = new CredentialService();
