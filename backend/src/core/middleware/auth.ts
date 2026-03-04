import { createIdpAuthMiddleware } from '../auth/idpRegistry';

/** Composite IdP auth middleware: tries each configured IdP plugin in order; first success wins. Use this for protected routes. */
export const checkJwt = () => createIdpAuthMiddleware();
