import { pool } from '../../db/client';
import { log } from '../../logging';
import {
  getTempStorageAdapter,
  resolveActivePluginCode,
} from '../../integrations/plugins/PluginRegistry';
import {
  tempStorageSelfTest,
  type TempStorageSelfTestResult,
} from '../../integrations/temp-storage/tempStorageSelfTest';

/** Run a check; swallow sync throws and rejections. */
async function probe(check: () => Promise<boolean>): Promise<boolean> {
  try {
    return await check();
  } catch {
    return false;
  }
}

/** Log a one-shot up/down ping of db and temp storage at startup. Log-only;
 *  never throws. Deeper per-service checks run separately below. */
export async function logStartupHealth(): Promise<void> {
  const [db, tempStorage] = await Promise.all([
    probe(() => pool.query('SELECT 1').then(() => true)),
    probe(() => getTempStorageAdapter().ping()),
  ]);

  const health = { db, tempStorage };
  const unreachable = Object.entries(health)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  if (unreachable.length > 0) {
    log.warn({ health }, `Startup health: unreachable: ${unreachable.join(', ')}`);
  } else {
    log.info({ health }, 'Startup health: all dependencies reachable');
  }
}

/** Log the temp-storage self-test (write + read back + remove), including backend
 *  and path. Failed round-trip logs WARN. Never throws. */
export async function logTempStorageSelfTest(): Promise<void> {
  let result: TempStorageSelfTestResult;
  try {
    result = await tempStorageSelfTest(getTempStorageAdapter());
  } catch (err) {
    log.warn({ err }, 'Temp storage self-test could not run');
    return;
  }

  const tempStorage = {
    code: resolveActivePluginCode('tempStorage'),
    path: result.path,
    roundTrip: result.roundTrip,
  };

  if (result.roundTrip) {
    log.info({ tempStorage }, 'Temp storage self-test: read/write OK');
  } else {
    log.warn({ tempStorage, message: result.message }, 'Temp storage self-test: read/write failed');
  }
}
