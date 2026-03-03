import { env } from './core/config/env';
env.loadEnv();

import express from 'express';
import session from 'express-session';
import passport from 'passport';
import rTracer from 'cls-rtracer';
import { router } from './routes';
import cors from 'cors';
import { checkJwt } from './middleware/auth';
import { coreRouter } from './core/api';
import { healthRouter } from './core/api/health';
import { metaRouter } from './core/api/meta';
import { buildOpenApiSpec } from './core/api/shared/openapi';
import swaggerUi from 'swagger-ui-express';
import { log } from './core/logging';
import pinoHttp from 'pino-http';

const app = express();
const port = 4000;

if (process.env.NODE_ENV === 'development') {
  log.info('Allowing CORS for development environment');
  app.use(cors());
} else {
  log.info('Blocking CORS for production environment');
}

app.use(
  session({
    secret: process.env.SESSION_SECRET,
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// Request-scoped correlation id (CLS). Must be before any middleware that logs or needs request id.
app.use(
  rTracer.expressMiddleware({
    useHeader: true,
    headerName: 'X-Request-Id',
    echoHeader: true,
  }),
);

// HTTP request/response logging (correlation id is added by logger mixin and genReqId).
app.use(
  pinoHttp({
    logger: log,
    genReqId: (): string | number | undefined => rTracer.id() as string | number | undefined,
  }),
);

// ——— Public routes (no authentication) ———
app.get('/api/docs/openapi.json', (_req, res) => {
  res.json(buildOpenApiSpec());
});
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(null, {
    swaggerOptions: {
      url: '/api/docs/openapi.json',
    },
  }),
);
// ——— Core v1: mount before /api so /api/v1/* is not caught by legacy catch-all ———
// Meta and health are public (no auth); forms/submissions require JWT then actor resolution then core context.
import { resolveActor } from './middleware/actor';
import { requireSobaAdmin } from './core/middleware/requireSobaAdmin';
import { adminRouter } from './core/api/admin';
app.use('/api/v1/meta', express.json(), metaRouter);
app.use('/api/v1/health', healthRouter);
app.use('/api/v1', express.json(), checkJwt(), resolveActor, coreRouter);
app.use('/api/v1/admin', express.json(), checkJwt(), resolveActor, requireSobaAdmin, adminRouter);

// ——— Legacy API: /api/form/* requires JWT ———
app.use('/api', router);

app.listen(port, () => {
  log.info({ port }, 'Express is listening');
});
