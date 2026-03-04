import { createIdpAuthMiddleware } from '../auth/idpRegistry';

declare module 'express-serve-static-core' {
  interface Request {
    decodedJwt?: Record<string, unknown>;
    /** Validated token payload; set by IdP plugin middleware. Same as decodedJwt for compatibility. */
    authPayload?: Record<string, unknown>;
    bceidType?: 'bceidbasic' | 'bceidbusiness';
    /** Identity provider code from token (e.g. idir, azureidir, bceidbasic, bceidbusiness). */
    idpType?: string;
    /** Code of the IdP plugin that validated the token (e.g. bcgov-sso). */
    idpPluginCode?: string;
  }
}

/** Composite IdP auth middleware: tries each configured IdP plugin in order; first success wins. Use this for protected routes. */
export const checkJwt = () => createIdpAuthMiddleware();
