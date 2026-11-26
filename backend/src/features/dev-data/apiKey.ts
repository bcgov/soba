import { Features } from '../../core/db/codes';
import { db } from '../../core/db/client';
import {
  credentialTypeAssignments,
  workspaceCredentials,
} from '../../core/db/schema/workspaceCredential';
import { resolveDefaultCredentialIssuerCode } from '../../core/integrations/credential-issuer/CredentialIssuerRegistry';
import { isFeatureAvailable } from '../../core/services/featureAvailabilityService';

/** The local default. A real issuer never issued this key, so it could not regenerate or delete it. */
const NOOP_ISSUER_CODE = 'credential-issuer-noop';

export interface ManifestApiKey {
  workspaceId: string;
  /** Sent as X-API-KEY to the local dev gateway, which passes it on as the consumer. */
  clientId: string;
  /**
   * Whether api-keys was available in the workspace at seed time. The integration API refuses the
   * key while it is not.
   */
  apiKeysAvailable: boolean;
}

/**
 * One active API key in a generated workspace, for calling the integration API through the local
 * dev gateway. Created only under the no-op issuer, where the integration API looks keys up
 * locally; null otherwise. Only purge removes it, as delete needs an issuer.
 */
export async function createDevApiKey(
  runId: string,
  workspaceId: string,
  actorId: string,
): Promise<ManifestApiKey | null> {
  if (resolveDefaultCredentialIssuerCode() !== NOOP_ISSUER_CODE) return null;
  const clientId = `dev-data-${runId}`;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(workspaceCredentials)
      .values({
        workspaceId,
        formId: null,
        issuerCode: NOOP_ISSUER_CODE,
        clientId,
        label: '[dev] Integration API',
        notes:
          'Created by dev-data for the local dev gateway; the seed prints its client ID. Purge removes it.',
        status: 'active',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning({ id: workspaceCredentials.id });
    if (!row) throw new Error('Dev API key was not written');
    await tx.insert(credentialTypeAssignments).values({
      workspaceId,
      credentialId: row.id,
      typeCode: 'api',
    });
  });
  const apiKeysAvailable = await isFeatureAvailable(Features.api_keys, {
    workspaceId,
    formId: null,
  });
  return { workspaceId, clientId, apiKeysAvailable };
}
