import { env } from './core/config/env';
env.loadEnv();
import { createApp } from './createApp';
import { pool } from './core/db/client';
import { log } from './core/logging';
import { assertJobShutdownFits, getJobSettings, startJobs, stopJobs } from './core/jobs';
import { assertAppLinkBases } from './core/appLinks';
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
const port = Number(process.env.PORT) || 4000;
// Read before listening, so an invalid value stops startup before the port opens.
const shutdownSettings = env.getShutdownSettings();
assertJobShutdownFits(getJobSettings(), shutdownSettings.timeoutMs);
assertAppLinkBases({
  DESIGNER_APP_URL: env.getDesignerAppUrl(),
  FORMS_APP_URL: env.getFormsAppUrl(),
});

const app = createApp();

const server = app.listen(port, () => {
  log.info({ port }, 'Express is listening');
  startJobs();
  void logStartupHealth()
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
});

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
    .then(() => new Promise<void>((resolve) => server.close(() => resolve())))
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      log.error({ err }, 'Shutdown failed');
      process.exit(1);
    });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
