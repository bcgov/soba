import { env } from './core/config/env';
env.loadEnv();

import express from 'express';
import session from 'express-session';
import passport from 'passport';
import rTracer from 'cls-rtracer';
import { router } from './routes';
import cors from 'cors';
import { createJwtMiddleware } from './middleware/auth';
import { coreRouter } from './core/api';
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
app.get('/api/health', (_, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ——— Core v1: mount before /api so /api/v1/* is not caught by legacy catch-all ———
// Meta is public (no auth); forms/submissions require JWT.
app.use('/api/v1/meta', express.json(), metaRouter);
app.use('/api/v1', express.json(), createJwtMiddleware(), coreRouter);

// ——— Legacy API: /api/form/* requires JWT ———
app.use('/api', router);

app.listen(port, () => {
  log.info({ port }, 'Express is listening');
});
