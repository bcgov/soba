import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

// Env is loaded by process entrypoints before db modules are imported.
const databaseUrl = env.getDatabaseUrl();
const dbPoolMax = env.getNumberEnv('DB_POOL_MAX', 10);

const pool = new Pool({
  connectionString: databaseUrl,
  max: dbPoolMax,
});

export const db = drizzle(pool, { schema });
export { pool };
