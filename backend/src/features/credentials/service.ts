import { ConflictError, NotFoundError, ServiceUnavailableError } from '../../core/errors';
import {
  createCredentialIssuerAdapter,
  resolveDefaultCredentialIssuerCode,
} from '../../core/integrations/credential-issuer/CredentialIssuerRegistry';
import type {
  CredentialIssuerAdapter,
  IssuedApiKey,
} from '../../core/integrations/credential-issuer/CredentialIssuerAdapter';
import * as repo from '../../core/db/repos/workspaceCredentialRepo';

export const credentialMetadata = (record: repo.CredentialRecord) => ({
  id: record.id,
  label: record.id.toUpperCase(),
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

export class WorkspaceCredentialService {
  async get(workspaceId: string) {
    const record = await repo.getWorkspaceCredential(workspaceId);
    let available = false;
    try {
      configuredIssuer(record?.issuerCode ?? resolveDefaultCredentialIssuerCode());
      available = true;
    } catch {
      /* Unavailable issuer is reported without exposing configuration. */
    }
    return { available, credential: record ? credentialMetadata(record) : null };
  }

  async issue(workspaceId: string, actorId: string) {
    const issuerCode = resolveDefaultCredentialIssuerCode();
    const issuer = configuredIssuer(issuerCode);
    const record = await repo.reserveWorkspaceCredential(workspaceId, issuerCode, actorId);
    if (!record)
      throw new ConflictError(
        'This workspace already has a credential or an operation awaiting reconciliation',
      );
    return this.perform(record, actorId, () =>
      issuer.issue({
        applicationName: `soba-workspace-${workspaceId}`,
        labels: { 'issued-by': 'soba', 'workspace-id': workspaceId },
      }),
    );
  }

  async regenerate(workspaceId: string, id: string, actorId: string) {
    const existing = await repo.getWorkspaceCredential(workspaceId);
    if (existing?.id !== id) throw new NotFoundError('Credential not found');
    if (existing.status !== 'active' || !existing.clientId)
      throw new ConflictError('Credential operation is pending or requires reconciliation');
    const issuer = configuredIssuer(existing.issuerCode);
    const record = await repo.reserveCredentialRotation(workspaceId, id, actorId);
    if (!record) throw new ConflictError('Another credential operation has started');
    return this.perform(record, actorId, () => issuer.regenerate(existing.clientId!));
  }

  async updateNotes(workspaceId: string, id: string, actorId: string, notes: string) {
    const record = await repo.updateCredentialNotes(workspaceId, id, actorId, notes);
    if (!record) throw new NotFoundError('Credential not found');
    return credentialMetadata(record);
  }

  private async perform(
    record: repo.CredentialRecord,
    actorId: string,
    operation: () => Promise<IssuedApiKey>,
  ) {
    try {
      const issued = await operation();
      const saved = await repo.completeCredentialOperation(record, actorId, issued);
      return { credential: credentialMetadata(saved), apiKey: issued.apiKey };
    } catch {
      // If persistence also fails, the pending reservation still blocks duplicate issuance.
      try {
        await repo.markCredentialUnknown(record, actorId);
      } catch {
        /* Retain pending reservation. */
      }
      throw new ServiceUnavailableError(
        'Credential operation did not complete. Its outcome may be unknown; an administrator must reconcile it before another attempt.',
      );
    }
  }
}
export const workspaceCredentialService = new WorkspaceCredentialService();
