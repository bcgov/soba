import { Request, Response, NextFunction } from 'express'
import { expressjwt as jwt } from 'express-jwt'
import jwksRsa from 'jwks-rsa'

interface CheckJwtOptions {}

declare global {
  namespace Express {
    interface Request {
      decodedJwt?: {
        [key: string]: any
      }
      bceidType?: 'bceidbasic' | 'bceidbusiness'
      idpType?: 'idir' | 'bceidbasic' | 'bceidbusiness'
    }
  }
}

export const ROLE_FIELD = process.env.ROLE_FIELD || 'Role'

export const createJwtMiddleware = (options: CheckJwtOptions = {}) => {

  return jwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      jwksUri: process.env.JWKS_URI!,
      handleSigningKeyError: (err, cb) => {
        console.error('Error:', { error: err?.message, stack: err?.stack })
        cb(new Error('Error occurred during authentication'))
      },
    }),
    issuer: process.env.JWT_ISSUER!,
    audience: process.env.JWT_AUDIENCE,
    algorithms: ['RS256'],
    requestProperty: 'decodedJwt',
    getToken: function fromHeaderOrQuerystring(req) {
      try {
        if (!req || !req.headers) return null

        // Prefer Authorization: Bearer <token>
        const authHeader = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization
        if (authHeader && typeof authHeader === 'string') {
          const parts = authHeader.split(' ')
          if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
            const token = parts[1]
            console.debug('JWT extracted from Authorization header')
            return token
          }
        }

        // Accept X-Jwt-Token (case-insensitive) header
        const tokenHeader = (req.get && req.get('X-Jwt-Token')) || (req.headers['x-jwt-token'] as string) || (req.headers['X-Jwt-Token'] as string)
        if (tokenHeader && typeof tokenHeader === 'string') {
          console.debug('JWT extracted from X-Jwt-Token header')
          return tokenHeader
        }

        // Fallback: query parameter 'token' or 'x-jwt-token'
        const q = (req as any).query
        if (q) {
          if (q.token && typeof q.token === 'string') {
            console.debug('JWT extracted from query param token')
            return q.token
          }
          if (q['x-jwt-token'] && typeof q['x-jwt-token'] === 'string') {
            console.debug('JWT extracted from query param x-jwt-token')
            return q['x-jwt-token']
          }
        }

        return null
      } catch (err) {
        console.error('getToken error', err)
        return null
      }
    },
  })
}

export const checkJwt = (options: CheckJwtOptions = {}) => {
  const middleware = createJwtMiddleware(options)

  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err) => {
      if (err) {
        console.error('JWT Validation Error:', {
          error: err.message,
          code: err.code,
          inner: err.inner?.message,
        })

        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Error occurred during authentication',
          statusCode: 401,
        })
      }

      if (req.decodedJwt) {
        const provider = req.decodedJwt.idp || req.decodedJwt.identity_provider

        req.idpType = 'idir'
      }

      next()
    })
  }
}

export const extractOidcSub = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.decodedJwt) {
    console.log('Authenticated request', {
      sub: req.decodedJwt.sub,
      //   token: req.headers.authorization?.split(' ')[1]?.substring(0, 20) + '...',
      decodedJwt: req.decodedJwt,
    })
    next()
  } else {
    console.error('No decodedJwt found in request')
    res.status(401).json({ error: 'Error ocurred during authentication' })
  }
}

export const jwtErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err.name === 'UnauthorizedError') {
    console.error('JWT Validation Error (fallback):', {
      error: err.message,
      code: err.code,
      inner: err.inner?.message,
    })

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Error occurred during authentication',
      statusCode: 401,
    })
  }
  next(err)
}

export const hasRole = (user, role) => {
  return user && user[ROLE_FIELD] && user[ROLE_FIELD].includes(role);
}