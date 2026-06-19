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
import { initializePassport } from './core/auth/passport';
import {
  checkJwtOptional,
  resolveActorOptional,
  checkFormVisibility,
} from './core/middleware/formVisibility';
import { createSubmission, saveSubmission } from './core/api/submissions/controller';

const app = express();
const port = Number(process.env.PORT) || 4000;

// Trust X-Forwarded-* from a bounded number of proxies (not `true` — breaks express-rate-limit IP keys)
app.set('trust proxy', env.getTrustProxySetting());

initializePassport();

// The browser can only read the echoed workspace header if it's explicitly exposed.
const corsExposedHeaders = ['x-soba-workspace-id'];
const corsOrigin = process.env.CORS_ORIGIN;
if (process.env.NODE_ENV === 'development') {
  log.info('Allowing CORS for development environment');
  app.use(cors({ origin: 'http://localhost:3000', exposedHeaders: corsExposedHeaders }));
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
      exposedHeaders: corsExposedHeaders,
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

publicSubmissionRouter.post('/submissions', ...publicSubmissionMiddleware, createSubmission);
publicSubmissionRouter.post('/submissions/:id/save', ...publicSubmissionMiddleware, saveSubmission);

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
