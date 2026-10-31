import {
  markCredentialUnknown,
  type CredentialRecord,
} from '../../core/db/repos/workspaceCredentialRepo';
import { ServiceUnavailableError } from '../../core/errors';
import { upstreamStatusOf } from '../../core/http/httpErrorMapper';
import { log } from '../../core/logging';

export type CredentialOperationStage = 'upstream' | 'persistence';

/** Retain the reservation and expose only a generic reconciliation error to the caller. */
export async function failCredentialOperation(
  record: CredentialRecord,
  actorId: string,
  stage: CredentialOperationStage,
  error: unknown,
): Promise<never> {
  const context = {
    credentialId: record.id,
    workspaceId: record.workspaceId,
    issuerCode: record.issuerCode,
    operation: record.status === 'rotating' ? 'regenerate' : 'issue',
  };
  // Allowlisted diagnostics only: errors, messages, causes and upstream bodies can hold secrets.
  log.warn(
    { ...context, stage, upstreamStatus: upstreamStatusOf(error) },
    'Credential operation outcome requires reconciliation',
  );
  try {
    await markCredentialUnknown(record, actorId);
  } catch {
    // A failed recovery write leaves the existing issuing/rotating reservation in place.
    log.error(
      { ...context, stage: 'reconciliation' },
      'Could not mark credential outcome unknown; pending reservation retained',
    );
  }
  throw new ServiceUnavailableError(
    'Credential operation did not complete. Its outcome may be unknown; an administrator must reconcile it before another attempt.',
  );
}
