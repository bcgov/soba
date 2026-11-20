import express from 'express';
import { coreErrorHandler, notFoundHandler } from '../../core/middleware/errorHandler';
import {
  resolveIntegrationCredential,
  verifyIntegrationGateway,
} from '../middleware/resolveCredential';
import { buildIntegrationV2OpenApiSpec } from './openapi';
import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { gatewayClientId } from '../middleware/gatewayJwt';
import {
  integrationConsumerRateLimit,
  integrationPublicRateLimit,
  integrationUnverifiedRateLimit,
} from '../../core/middleware/rateLimit';

const router = express.Router();

// Public liveness for direct probes; a supplied gateway JWT must verify successfully.
// CI can verify the gateway hop without creating a credential record in every PR database.
router.get(
  '/health',
  integrationPublicRateLimit,
  asyncHandler(async (req, res) => {
    const gatewayToken = req.headers['gw-jwt'];
    if (gatewayToken !== undefined) await gatewayClientId(gatewayToken);
    res.set('Cache-Control', 'no-store');
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      ...(gatewayToken === undefined ? {} : { gatewayAuthenticated: true }),
    });
  }),
);

router.get('/openapi.json', integrationPublicRateLimit, (_req, res) => {
  res.json(buildIntegrationV2OpenApiSpec());
});

// Identity introspection only; resource access requires additional per-request authorization.
router.get(
  '/me',
  integrationUnverifiedRateLimit,
  verifyIntegrationGateway,
  integrationConsumerRateLimit,
  resolveIntegrationCredential,
  (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      credential: {
        id: req.integrationCredential!.id,
        clientId: req.integrationCredential!.clientId,
        workspaceId: req.integrationCredential!.workspaceId,
        formId: req.integrationCredential!.formId,
      },
      method: req.method,
      path: `${req.baseUrl}${req.path}`,
      ip: req.ip,
    });
  },
);

router.use(integrationPublicRateLimit, notFoundHandler);
router.use(coreErrorHandler);

export const integrationV2Router = router;
