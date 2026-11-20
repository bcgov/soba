jest.mock('jwks-rsa', () => ({ __esModule: true, default: jest.fn() }));

import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { createJwksVerifier, SigningKeyUnavailableError } from '../../../src/core/auth/jwks';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const token = jwt.sign({ sub: 'x' }, keys.privateKey, {
  algorithm: 'RS256',
  keyid: 'k1',
  issuer: 'https://issuer.example.test',
  audience: 'aud',
  expiresIn: 60,
});
const verifier = () =>
  createJwksVerifier({
    jwksUri: 'https://issuer.example.test/certs',
    issuer: 'https://issuer.example.test',
    audience: 'aud',
    jwksOptions: { timeout: 10 },
  });

describe('createJwksVerifier', () => {
  it('gives up on a key set that never answers, as unavailable keys', async () => {
    jest.mocked(jwksRsa).mockReturnValue({
      getSigningKey: () => new Promise(() => {}),
    } as unknown as ReturnType<typeof jwksRsa>);
    await expect(verifier()(token)).rejects.toBeInstanceOf(SigningKeyUnavailableError);
  });

  it('treats a key the key set does not hold as an invalid token, not unavailable keys', async () => {
    jest.mocked(jwksRsa).mockReturnValue({
      getSigningKey: () =>
        Promise.reject(Object.assign(new Error('no key'), { name: 'SigningKeyNotFoundError' })),
    } as unknown as ReturnType<typeof jwksRsa>);
    const rejection = verifier()(token);
    await expect(rejection).rejects.toThrow();
    await expect(rejection).rejects.not.toBeInstanceOf(SigningKeyUnavailableError);
  });
});
