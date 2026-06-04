import { env } from './core/config/env';
env.loadEnv();

import express from 'express';
import rTracer from 'cls-rtracer';
import cors from 'cors';
import passport from 'passport';
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
import { initializePassport } from './core/auth/passport';
import {
  checkJwtOptional,
  resolveActorOptional,
  checkFormVisibility,
} from './core/middleware/formVisibility';
import { getFormByEngineRef } from './core/api/forms/controller';
import { createSubmission, saveSubmission } from './core/api/submissions/controller';

const app = express();
const port = Number(process.env.PORT) || 4000;

// Trust X-Forwarded-* from a bounded number of proxies (not `true` — breaks express-rate-limit IP keys)
app.set('trust proxy', env.getTrustProxySetting());

initializePassport();

const corsOrigin = process.env.CORS_ORIGIN;
if (process.env.NODE_ENV === 'development') {
  log.info('Allowing CORS for development environment');
  app.use(cors());
} else if (corsOrigin) {
  const origins = corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  log.info({ origins }, 'Allowing CORS for configured origins');
  app.use(
    cors({
      origin: origins.length === 1 ? origins[0] : origins,
      credentials: true,
    }),
  );
} else {
  log.info('No CORS_ORIGIN set; cross-origin requests will be blocked');
}

app.use(
  rTracer.expressMiddleware({
    useHeader: true,
    headerName: 'X-Request-Id',
    echoHeader: true,
  }),
);

app.use(httpLogger);
app.use(passport.initialize());

app.use(globalRateLimit);

// ——— Form-engine proxy/routes under /api/v1 (protected; when PLUGIN_<CODE>_ROUTES_ALLOWED=true) ———
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

// ——— Public Submission Routes (Optionally Authenticated) ———
const publicSubmissionRouter = express.Router();
const publicSubmissionMiddleware = [
  apiRateLimit,
  express.json(),
  checkJwtOptional(),
  resolveActorOptional,
  checkFormVisibility,
];

publicSubmissionRouter.get(
  '/forms/engine/:engineRef',
  ...publicSubmissionMiddleware,
  getFormByEngineRef,
);
publicSubmissionRouter.post('/submissions', ...publicSubmissionMiddleware, createSubmission);
publicSubmissionRouter.post('/submissions/:id/save', ...publicSubmissionMiddleware, saveSubmission);

const formioDef = formEngineRouteDefs.find((d) => d.code === 'formio-v5');
if (formioDef) {
  const formioRouter = formioDef.createRouter(createPluginConfigReader('formio-v5'));
  publicSubmissionRouter.get(
    '/formio-v5/form/:id',
    ...publicSubmissionMiddleware,
    (req, res, next) => {
      req.url = `/form/${req.params.id}`;
      formioRouter(req, res, next);
    },
  );
  publicSubmissionRouter.post(
    '/formio-v5/form/:formId/submission',
    ...publicSubmissionMiddleware,
    (req, res, next) => {
      req.url = `/form/${req.params.formId}/submission`;
      formioRouter(req, res, next);
    },
  );
}

app.use('/api/v1', publicSubmissionRouter);

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
