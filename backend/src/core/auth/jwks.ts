import { expressjwt } from 'express-jwt';
import jwt, { type Algorithm, type JwtPayload, type VerifyOptions } from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { getToken } from './IdpPlugin';
import { log } from '../logging';

interface JwksVerificationOptions {
  jwksUri: string;
  issuer: string;
  audience?: string;
  algorithms?: Algorithm[];
  maxAge?: VerifyOptions['maxAge'];
  clockTolerance?: number;
  jwksOptions?: Omit<jwksRsa.Options, 'jwksUri'>;
}

const verificationOptions = ({
  issuer,
  audience,
  algorithms = ['RS256'],
  maxAge,
  clockTolerance,
}: JwksVerificationOptions): VerifyOptions => ({
  issuer,
  audience,
  algorithms,
  ...(maxAge === undefined ? {} : { maxAge }),
  ...(clockTolerance === undefined ? {} : { clockTolerance }),
});

const signingKeyResolver = ({ jwksUri, jwksOptions }: JwksVerificationOptions) => {
  const client = jwksRsa({ jwksUri, cache: true, ...jwksOptions });
  return async (header: jwt.JwtHeader) => {
    try {
      return (await client.getSigningKey(header.kid)).getPublicKey();
    } catch (err) {
      log.error({ err }, 'JWKS signing key error during authentication');
      throw new Error('Error occurred during authentication');
    }
  };
};

export const createJwksVerifier = (options: JwksVerificationOptions) => {
  const signingKey = signingKeyResolver(options);
  const verifyOptions = verificationOptions(options);
  const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
    signingKey(header)
      .then((key) => callback(null, key))
      .catch((error: Error) => callback(error));
  };
  return (token: string): Promise<JwtPayload> =>
    new Promise((resolve, reject) => {
      jwt.verify(token, getKey, verifyOptions, (error, decoded) => {
        if (error) return reject(error);
        if (!decoded || typeof decoded === 'string') return reject(new Error('Invalid JWT claims'));
        resolve(decoded);
      });
    });
};

export const createJwksExpressMiddleware = (options: JwksVerificationOptions) => {
  const signingKey = signingKeyResolver(options);
  return expressjwt({
    ...verificationOptions(options),
    algorithms: options.algorithms ?? ['RS256'],
    secret: async (_req, token) => {
      if (!token) throw new Error('Invalid JWT');
      return signingKey(token.header);
    },
    requestProperty: 'decodedJwt',
    getToken,
  });
};
