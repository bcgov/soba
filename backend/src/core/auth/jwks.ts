import jwt, { type Algorithm, type JwtPayload, type VerifyOptions } from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
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

/** The key set could not be read: unreachable, too slow, or over the fetch rate limit. */
export class SigningKeyUnavailableError extends Error {}

// jwks-rsa's timeout settles a lookup only before response headers arrive; after them it destroys the
// request without rejecting, and a trickling body never trips it.
const withDeadline = <T>(work: Promise<T>, ms: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Key set fetch took longer than ${ms} ms`)), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
};

const signingKeyResolver = ({ jwksUri, jwksOptions }: JwksVerificationOptions) => {
  const client = jwksRsa({ jwksUri, cache: true, ...jwksOptions });
  // A second past the client's own timeout (jwks-rsa defaults to 30 seconds).
  const deadlineMs = (jwksOptions?.timeout ?? 30_000) + 1_000;
  return async (header: jwt.JwtHeader) => {
    try {
      return (await withDeadline(client.getSigningKey(header.kid), deadlineMs)).getPublicKey();
    } catch (err) {
      // By name: jwks-rsa's error classes are not exported where the module is mocked.
      if (err instanceof Error && err.name === 'SigningKeyNotFoundError') {
        log.warn({ kid: header.kid, jwksUri }, 'JWT names a signing key the key set does not hold');
        throw new Error('Unknown signing key');
      }
      log.error({ err, jwksUri }, 'JWKS signing key error during authentication');
      throw new SigningKeyUnavailableError('Signing keys are unavailable');
    }
  };
};

/** A key lookup for jwt.verify that keeps its own error, which jsonwebtoken would wrap. */
const keyLookup = (signingKey: ReturnType<typeof signingKeyResolver>) => {
  const lookup: { error?: unknown; getKey: jwt.GetPublicKeyOrSecret } = {
    getKey: (header, callback) => {
      signingKey(header)
        .then((key) => callback(null, key))
        .catch((error: Error) => {
          lookup.error = error;
          callback(error);
        });
    },
  };
  return lookup;
};

export const createJwksVerifier = (options: JwksVerificationOptions) => {
  const signingKey = signingKeyResolver(options);
  const verifyOptions = verificationOptions(options);
  return (token: string): Promise<JwtPayload> =>
    new Promise((resolve, reject) => {
      const lookup = keyLookup(signingKey);
      jwt.verify(token, lookup.getKey, verifyOptions, (error, decoded) => {
        if (error) {
          return reject(lookup.error instanceof SigningKeyUnavailableError ? lookup.error : error);
        }
        if (!decoded || typeof decoded === 'string') return reject(new Error('Invalid JWT claims'));
        resolve(decoded);
      });
    });
};
