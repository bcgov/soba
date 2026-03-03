import { Request, Response } from 'express';
import { pool } from '../../db/client';
import { checkFormEngineHealth } from '../../integrations/form-engine/FormEngineRegistry';

export async function readinessHandler(_req: Request, res: Response): Promise<void> {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch {
    // dbOk stays false
  }

  const formEngines = await checkFormEngineHealth();
  const allEnginesOk = Object.values(formEngines).every((r) => r.ok);

  const body = {
    status: dbOk && allEnginesOk ? 'ready' : 'unhealthy',
    db: dbOk ? 'ok' : 'unreachable',
    formEngines,
  };

  if (!dbOk || !allEnginesOk) {
    res.status(503).json(body);
    return;
  }
  res.status(200).json(body);
}
