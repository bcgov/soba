import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { findActiveApiCredential } from '../../core/db/repos/workspaceCredentialRepo';
import { resolveDefaultCredentialIssuerCode } from '../../core/integrations/credential-issuer/CredentialIssuerRegistry';
import { UnauthorizedError } from '../../core/errors';
import { gatewayClientId } from './gatewayJwt';

/**
 * Authenticate the gateway JWT first, then resolve its signed consumer identity.
 * Unsigned X-Consumer-* headers and the original API key are not used for identity.
 */
export const resolveIntegrationCredential = asyncHandler(async (req, _res, next) => {
  const clientId = await gatewayClientId(req.headers['gw-jwt']);
  const credential = await findActiveApiCredential(resolveDefaultCredentialIssuerCode(), clientId);
  if (!credential) throw new UnauthorizedError('API credential is not active');
  req.integrationCredential = credential;
  next();
});
