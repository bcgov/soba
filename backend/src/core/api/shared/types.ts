import { Request } from 'express';
import { CoreRequestContext } from '../../middleware/requestContext';

/**
 * Request type for core API routes that run after coreContextMiddleware.
 * coreContext is always set; no need for non-null assertion.
 */
export interface CoreRequest<P = unknown, ResBody = unknown, ReqBody = unknown> extends Request<
  P,
  ResBody,
  ReqBody
> {
  coreContext: CoreRequestContext;
}
