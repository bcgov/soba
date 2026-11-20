import express from 'express';
import rTracer from 'cls-rtracer';
import { env } from '../core/config/env';
import { httpLogger } from '../core/logging';
import { coreErrorHandler, notFoundHandler } from '../core/middleware/errorHandler';
import { globalRateLimit, publicRateLimit } from '../core/middleware/rateLimit';
import { integrationV2Router } from './v2/routes';

/**
 * The integration API, served on its own port. The Route and the router NetworkPolicy cover only
 * the main port; from outside the release, only the APS NetworkPolicy admits this one.
 */
export const createIntegrationApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.getTrustProxySetting());
  app.use(
    rTracer.expressMiddleware({
      useHeader: true,
      headerName: 'X-Request-Id',
      echoHeader: true,
    }),
  );
  app.use(httpLogger);
  app.use(globalRateLimit);

  // Integration v1 is reserved for CHEFS Classic compatibility.
  app.use(`${env.getApiBasePath()}/api/integrations/v2`, publicRateLimit, integrationV2Router);

  app.use(notFoundHandler);
  app.use(coreErrorHandler);
  return app;
};
