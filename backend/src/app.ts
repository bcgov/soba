import { env } from './core/config/env';
env.loadEnv();

import express from 'express';
import rTracer from 'cls-rtracer';
import cors from 'cors';
import { checkJwt } from './core/middleware/auth';
import { coreRouter } from './core/api';
import { healthRouter } from './core/api/health';
import { metaRouter } from './core/api/meta';
import { buildOpenApiSpec } from './core/api/shared/openapi';
import swaggerUi from 'swagger-ui-express';
import { httpLogger, log } from './core/logging';
import { resolveActor } from './core/middleware/actor';
import { requireSobaAdmin } from './core/middleware/requireSobaAdmin';
import { adminRouter } from './core/api/admin';
import { globalRateLimit, apiRateLimit, publicRateLimit } from './core/middleware/rateLimit';
import { getFormEngineRouteDefinitions } from './core/integrations/plugins/PluginRegistry';
import { createPluginConfigReader } from './core/config/pluginConfig';

const app = express();
const port = 4000;

if (process.env.NODE_ENV === 'development') {
  log.info('Allowing CORS for development environment');
  app.use(cors());
} else {
  log.info('Blocking CORS for production environment');
}

app.use(
  rTracer.expressMiddleware({
    useHeader: true,
    headerName: 'X-Request-Id',
    echoHeader: true,
  }),
);

app.use(httpLogger);

app.use(globalRateLimit);

// ——— Form-engine proxy/routes under /api/v1 (protected; when PLUGIN_<CODE>_ROUTES_ENABLED=true) ———
const formEngineRouteDefs = getFormEngineRouteDefinitions();
for (const def of formEngineRouteDefs) {
  const path = `/api/v1${def.routeBasePath.startsWith('/') ? '' : '/'}${def.routeBasePath}`;
  app.use(
    path,
    apiRateLimit,
    express.json(),
    checkJwt(),
    resolveActor,
    def.createRouter(createPluginConfigReader(def.code)),
  );
  log.info({ code: def.code, path }, 'Form-engine routes mounted');
}

// ——— Public routes (no authentication) ———
app.get('/api/docs/openapi.json', publicRateLimit, (_req, res) => {
  res.json(buildOpenApiSpec());
});
app.use(
  '/api/docs',
  publicRateLimit,
  swaggerUi.serve,
  swaggerUi.setup(null, {
    swaggerOptions: {
      url: '/api/docs/openapi.json',
    },
  }),
);

// ——— Core v1 API ———
app.use('/api/v1/meta', publicRateLimit, express.json(), metaRouter);
app.use('/api/v1/health', publicRateLimit, healthRouter);
app.use('/api/v1', apiRateLimit, express.json(), checkJwt(), resolveActor, coreRouter);
app.use(
  '/api/v1/admin',
  apiRateLimit,
  express.json(),
  checkJwt(),
  resolveActor,
  requireSobaAdmin,
  adminRouter,
);

app.listen(port, () => {
  log.info({ port }, 'Express is listening');
});
