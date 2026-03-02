import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';
import { drizzleQueryLogger } from './queryLogger';

// Env is loaded by process entrypoints before db modules are imported.
const databaseUrl = env.getDatabaseUrl();
const dbPoolMax = env.getNumberEnv('DB_POOL_MAX') ?? 10;

const pool = new Pool({
  connectionString: databaseUrl,
  max: dbPoolMax,
});

export const db = drizzle(pool, { schema, logger: drizzleQueryLogger });
export type Db = typeof db;
/** Type of the argument passed to db.transaction callback; use for optional tx in repos. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Db or Tx for repo functions that accept an optional transaction. */
export type DbOrTx = Db | Tx;
export { pool };
