jest.mock('jwks-rsa', () => ({ __esModule: true, default: jest.fn() }));
import { generateKeyPairSync } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { createJwksExpressMiddleware } from '../../../src/core/auth/jwks';
import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const getSigningKey = jest.fn();
jest.mocked(jwksRsa).mockReturnValue({ getSigningKey } as unknown as ReturnType<typeof jwksRsa>);
const issuer = 'https://sso.example.test';
const audience = 'staff-app';
const app = express();
app.get(
  '/staff',
  createJwksExpressMiddleware({ jwksUri: `${issuer}/certs`, issuer, audience }),
  (req, res) => res.json({ subject: req.decodedJwt?.sub }),
);
app.use(coreErrorHandler);
const token = (options: jwt.SignOptions = {}) =>
  jwt.sign({ sub: 'staff-user' }, keys.privateKey, {
    algorithm: 'RS256',
    keyid: 'staff-key',
    issuer,
    audience,
    expiresIn: 60,
    ...options,
  });
beforeEach(() => {
  jest.clearAllMocks();
  getSigningKey.mockResolvedValue({
    getPublicKey: () => keys.publicKey.export({ type: 'spki', format: 'pem' }),
  });
});
it('keeps staff bearer authentication and populates decodedJwt', async () => {
  const response = await request(app).get('/staff').set('Authorization', `Bearer ${token()}`);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ subject: 'staff-user' });
  expect(getSigningKey).toHaveBeenCalledWith('staff-key');
});
it('does not accept the gateway header as staff authentication', async () => {
  expect((await request(app).get('/staff').set('GW-JWT', token())).status).toBe(401);
  expect(getSigningKey).not.toHaveBeenCalled();
});
it.each([{ issuer: 'https://other.example.test' }, { audience: 'other-app' }, { expiresIn: -60 }])(
  'keeps rejecting invalid staff tokens %j',
  async (options) => {
    expect(
      (
        await request(app)
          .get('/staff')
          .set('Authorization', `Bearer ${token(options)}`)
      ).status,
    ).toBe(401);
  },
);
