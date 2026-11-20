import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { findActiveApiCredential } from '../../core/db/repos/workspaceCredentialRepo';
import { resolveDefaultCredentialIssuerCode } from '../../core/integrations/credential-issuer/CredentialIssuerRegistry';
import { UnauthorizedError } from '../../core/errors';
import { Features } from '../../core/db/codes';
import { isFeatureAvailable } from '../../core/services/featureAvailabilityService';
import { gatewayClientId } from './gatewayJwt';

/**
 * Verify the gateway JWT and record its signed consumer identity. Unsigned X-Consumer-* headers and
 * the original API key are not used for identity.
 */
export const verifyIntegrationGateway = asyncHandler(async (req, _res, next) => {
  req.integrationClientId = await gatewayClientId(req.headers['gw-jwt']);
  next();
});

/** Resolve the verified consumer to an active API credential. Runs after verifyIntegrationGateway. */
export const resolveIntegrationCredential = asyncHandler(async (req, _res, next) => {
  const clientId = req.integrationClientId;
  if (!clientId)
    throw new Error('resolveIntegrationCredential needs verifyIntegrationGateway first');
  const credential = await findActiveApiCredential(resolveDefaultCredentialIssuerCode(), clientId);
  // A key stops working where API keys are off, as it can no longer be seen or deleted there.
  const usable =
    credential &&
    (await isFeatureAvailable(Features.api_keys, {
      workspaceId: credential.workspaceId,
      formId: credential.formId,
    }));
  if (!credential || !usable) throw new UnauthorizedError('API credential is not active');
  req.integrationCredential = credential;
  next();
});
