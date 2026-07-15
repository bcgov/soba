import { Request, Response } from 'express';
import { pool } from '../../db/client';
import { checkFormEngineReadiness } from '../../integrations/form-engine/FormEngineRegistry';
import {
  checkStorageReadiness,
  getTempStorageAdapter,
  getVirusScanAdapter,
} from '../../integrations/plugins/PluginRegistry';

export async function readinessHandler(_req: Request, res: Response): Promise<void> {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch {
    // dbOk stays false
  }

  const formEngines = await checkFormEngineReadiness();
  const allEnginesOk = Object.values(formEngines).every((r) => r.ok);

  // Storage readiness is reported but non-gating — a storage outage degrades uploads, it doesn't
  // pull the pod from rotation (unlike DB and form engines).
  const storage = await checkStorageReadiness();

  // Temp storage is likewise reported but non-gating.
  let tempStorage: { ok: boolean; message?: string };
  try {
    tempStorage = { ok: await getTempStorageAdapter().ping() };
  } catch (err) {
    tempStorage = { ok: false, message: err instanceof Error ? err.message : String(err) };
  }

  // Virus scanner is reported but non-gating — a scanner outage blocks uploads (fail-closed at the
  // upload path), it doesn't pull the pod from rotation.
  let virusScanner: { ok: boolean; message?: string };
  try {
    virusScanner = { ok: await getVirusScanAdapter().ping() };
  } catch (err) {
    virusScanner = { ok: false, message: err instanceof Error ? err.message : String(err) };
  }

  const body = {
    status: dbOk && allEnginesOk ? 'ready' : 'unhealthy',
    db: dbOk ? 'ok' : 'unreachable',
    formEngines,
    storage,
    tempStorage,
    virusScanner,
  };

  if (!dbOk || !allEnginesOk) {
    res.status(503).json(body);
    return;
  }
  res.status(200).json(body);
}
