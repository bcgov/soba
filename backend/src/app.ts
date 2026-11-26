import { env } from './core/config/env';
env.loadEnv();
import { createApp } from './createApp';
import { createIntegrationApp } from './integration/createIntegrationApp';
import { pool } from './core/db/client';
import { log } from './core/logging';
import { assertJobShutdownFits, getJobSettings, startJobs, stopJobs } from './core/jobs';
import { assertAppLinkBases } from './core/appLinks';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import {
  logStartupHealth,
  logTempStorageSelfTest,
  logVirusScanSelfTest,
  logCacheSelfTest,
  logMessageBusSelfTest,
  logEventStreamSelfTest,
  logDocumentGenerationReadiness,
  logTenantEngineReadiness,
  logCredentialIssuerReadiness,
  logWorkflowEngineReadiness,
  logNotificationReadiness,
  logUserSearchReadiness,
} from './core/api/health';
import { getNotificationSettings } from './core/integrations/notification/settings';
import { assertPostSubmissionActionsInstalled } from './core/integrations/post-submission-action/PostSubmissionActionRegistry';
const port = Number(process.env.PORT) || 4000;
const integrationPort = env.getIntegrationPort();
// Read before listening, so an invalid value stops startup before the port opens.
const shutdownSettings = env.getShutdownSettings();
assertJobShutdownFits(getJobSettings(), shutdownSettings.timeoutMs);
getNotificationSettings();
assertPostSubmissionActionsInstalled();
assertAppLinkBases({
  DESIGNER_APP_URL: env.getDesignerAppUrl(),
  FORMS_APP_URL: env.getFormsAppUrl(),
});
if (integrationPort === port) {
  throw new Error(`INTEGRATION_PORT must differ from PORT; both are ${port}`);
}

const app = createApp();

const server = app.listen(port, () => {
  log.info({ port }, 'Express is listening');
});

const integrationServer = createIntegrationApp().listen(integrationPort, () => {
  log.info({ port: integrationPort }, 'Integration API is listening');
});

/** Startup diagnostics, one after another; a failure is logged, not fatal. */
const runStartupDiagnostics = () =>
  logStartupHealth()
    .then(logTempStorageSelfTest)
    .then(logVirusScanSelfTest)
    .then(logCacheSelfTest)
    .then(logMessageBusSelfTest)
    .then(logEventStreamSelfTest)
    .then(logDocumentGenerationReadiness)
    .then(logTenantEngineReadiness)
    .then(logCredentialIssuerReadiness)
    .then(logWorkflowEngineReadiness)
    .then(logNotificationReadiness)
    .then(logUserSearchReadiness)
    .catch((err) => log.warn({ err }, 'Startup diagnostics failed'));

// Jobs and startup diagnostics start once both servers are listening; a listen error on either
// exits the process. The rejection handler sees listen errors only, not a startJobs() failure.
Promise.all([once(server, 'listening'), once(integrationServer, 'listening')]).then(
  () => {
    startJobs();
    void runStartupDiagnostics();
  },
  (err: unknown) => {
    log.error({ err, port, integrationPort }, 'Server failed to listen');
    process.exit(1);
  },
);

const closeServer = (target: typeof server) =>
  new Promise<void>((resolve) => target.close(() => resolve()));

let shuttingDown = false;

/**
 * Node is PID 1 in the pod, so SIGTERM is ignored unless handled. On SIGTERM, keep serving for the
 * shutdown delay while routing moves off the pod, and drain jobs alongside; then stop serving, close
 * the pool and exit. SIGINT skips the delay. A second signal, or the shutdown timeout, exits at once.
 */
const shutdown = (signal: NodeJS.Signals): void => {
  if (shuttingDown) process.exit(1);
  shuttingDown = true;
  log.info({ signal }, 'Shutting down');
  setTimeout(() => {
    log.error({ timeoutMs: shutdownSettings.timeoutMs }, 'Shutdown timed out');
    process.exit(1);
  }, shutdownSettings.timeoutMs).unref();
  const serveMs = signal === 'SIGTERM' ? shutdownSettings.delayMs : 0;
  Promise.all([stopJobs(), delay(serveMs)])
    .then(() => Promise.all([closeServer(server), closeServer(integrationServer)]))
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      log.error({ err }, 'Shutdown failed');
      process.exit(1);
    });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
