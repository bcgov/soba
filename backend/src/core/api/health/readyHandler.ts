import { Request, Response } from 'express';
import { pool } from '../../db/client';
import { checkFormEngineReadiness } from '../../integrations/form-engine/FormEngineRegistry';
import { checkStorageReadiness } from '../../integrations/plugins/PluginRegistry';

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

  // Storage readiness is reported but non-gating: a storage outage degrades uploads only,
  // it does not take the app server out of rotation (unlike DB and form engines).
  const storage = await checkStorageReadiness();

  const body = {
    status: dbOk && allEnginesOk ? 'ready' : 'unhealthy',
    db: dbOk ? 'ok' : 'unreachable',
    formEngines,
    storage,
  };

  if (!dbOk || !allEnginesOk) {
    res.status(503).json(body);
    return;
  }
  res.status(200).json(body);
}
