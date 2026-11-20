import {
  createPublicKey,
  generateKeyPairSync,
  randomUUID,
  type JsonWebKey,
  type KeyObject,
} from 'node:crypto';

export interface SigningKey {
  privateKey: KeyObject;
  kid: string;
  /** The public half, as served from /certs. */
  jwk: JsonWebKey & { kid: string; use: 'sig'; alg: 'RS256' };
}

/**
 * A new RSA key for each start, held only in memory. The backend fetches /certs again when a token
 * names a kid it has not cached.
 */
export const createSigningKey = (): SigningKey => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = createPublicKey(privateKey).export({ format: 'jwk' });
  const kid = randomUUID();
  return { privateKey, kid, jwk: { ...publicJwk, kid, use: 'sig', alg: 'RS256' } };
};
