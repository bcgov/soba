import { createJwksVerifier } from '../../core/auth/jwks';
import { env } from '../../core/config/env';
import { ServiceUnavailableError, UnauthorizedError } from '../../core/errors';

let cached: { settingsKey: string; verify: ReturnType<typeof createJwksVerifier> } | undefined;

/** Verify only against configured APS keys; never follow a token's jku or trust its x5c. */
export const gatewayClientId = async (token: string | string[] | undefined): Promise<string> => {
  const settings = env.getIntegrationGatewaySettings();
  if (!settings) {
    throw new ServiceUnavailableError('Integration gateway JWT verification is not configured');
  }
  // GW-JWT carries the raw token (include_credential_type: false on the gateway).
  if (typeof token !== 'string' || !token || token.length > 16384) {
    throw new UnauthorizedError('Missing gateway JWT');
  }
  const settingsKey = JSON.stringify(settings);
  if (cached?.settingsKey !== settingsKey) {
    cached = {
      settingsKey,
      verify: createJwksVerifier({
        jwksUri: settings.jwksUri,
        issuer: settings.issuer,
        audience: settings.audience,
        algorithms: ['RS256'],
        maxAge: '2m',
        clockTolerance: 5,
        jwksOptions: { rateLimit: true, jwksRequestsPerMinute: 10, timeout: 5000 },
      }),
    };
  }
  try {
    const payload = await cached.verify(token);
    const id: unknown = payload[settings.clientIdClaim];
    if (
      typeof payload.exp !== 'number' ||
      typeof payload.iat !== 'number' ||
      payload.iat > Date.now() / 1000 + 5 ||
      typeof id !== 'string' ||
      !id.trim() ||
      id.includes(',')
    ) {
      throw new Error('Missing gateway identity or token lifetime');
    }
    return id;
  } catch {
    throw new UnauthorizedError('Invalid gateway JWT');
  }
};
