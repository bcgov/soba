import { Request, Response } from 'express';
import { pool } from '../../db/client';
import { checkFormEngineReadiness } from '../../integrations/form-engine/FormEngineRegistry';
import {
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

  // Non-gating: reported, but never fails the probe.
  let virusScannerOk = false;
  try {
    virusScannerOk = await getVirusScanAdapter().ping();
  } catch {
    // virusScannerOk stays false
  }

  let tempStorageOk = false;
  try {
    tempStorageOk = await getTempStorageAdapter().ping();
  } catch {
    // tempStorageOk stays false
  }

  const body = {
    status: dbOk && allEnginesOk ? 'ready' : 'unhealthy',
    db: dbOk ? 'ok' : 'unreachable',
    formEngines,
    virusScanner: virusScannerOk ? 'ok' : 'unreachable',
    tempStorage: tempStorageOk ? 'ok' : 'unreachable',
  };

  if (!dbOk || !allEnginesOk) {
    res.status(503).json(body);
    return;
  }
  res.status(200).json(body);
}
