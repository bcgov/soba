import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';

/** Test signing keys only; JWKS transport remains mocked explicitly in each suite. */
export const gatewayJwtFixture = (issuer: string, audience: string, clientId: string) => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const defaults: jwt.SignOptions = {
    algorithm: 'RS256',
    keyid: 'aps-key',
    issuer,
    audience,
    expiresIn: 60,
  };
  return {
    keys,
    otherKeys,
    publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }),
    sign: (claims: Record<string, unknown> = {}, options: jwt.SignOptions = {}) =>
      jwt.sign({ consumername: clientId, consumerid: 'kong-id', ...claims }, keys.privateKey, {
        ...defaults,
        ...options,
      }),
    signWithOtherKey: () => jwt.sign({ consumername: clientId }, otherKeys.privateKey, defaults),
  };
};
