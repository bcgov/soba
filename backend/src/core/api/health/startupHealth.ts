import { pool } from '../../db/client';
import { log } from '../../logging';
import {
  getTempStorageAdapter,
  getVirusScanAdapter,
} from '../../integrations/plugins/PluginRegistry';

/** Run a check, swallowing both sync throws (adapter construction) and rejections. */
async function probe(check: () => Promise<boolean>): Promise<boolean> {
  try {
    return await check();
  } catch {
    return false;
  }
}

/**
 * One-shot, fail-soft dependency probe logged at startup. Runs the same pings as
 * the readiness endpoint (db, virus scanner, temp storage) but only logs — it
 * never throws and never blocks boot, so a misconfigured scanner or unmounted temp
 * volume shows up in the pod logs immediately instead of only when /health/ready
 * is queried.
 */
export async function logStartupHealth(): Promise<void> {
  const [db, virusScanner, tempStorage] = await Promise.all([
    probe(() => pool.query('SELECT 1').then(() => true)),
    probe(() => getVirusScanAdapter().ping()),
    probe(() => getTempStorageAdapter().ping()),
  ]);

  const health = { db, virusScanner, tempStorage };
  const unreachable = Object.entries(health)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  if (unreachable.length > 0) {
    log.warn({ health }, `Startup health: unreachable: ${unreachable.join(', ')}`);
  } else {
    log.info({ health }, 'Startup health: all dependencies reachable');
  }
}
