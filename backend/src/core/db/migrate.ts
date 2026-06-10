// Must be first: initializes .env + .env.local for this process.
import { env } from '../config/env';
env.loadEnv();

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { db, pool } from './client';

const quoteIdentifier = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

// Pipeline performance fix: Revert if needed.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(label: string, task: () => Promise<T>): Promise<T> => {
  const attempts = env.getDbMigrationReadyAttempts();
  const sleepMs = env.getDbMigrationReadySleepMs();

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      console.error(`${label} failed on attempt ${attempt}/${attempts}`, error);
      if (attempt < attempts) {
        await sleep(sleepMs);
      }
    }
  }

  throw lastError;
};

const ensureDatabaseExists = async () => {
  const databaseUrl = env.getDatabaseUrl();

  const targetUrl = new URL(databaseUrl);
  const targetDbName = targetUrl.pathname.replace(/^\//, '');
  if (!targetDbName) {
    throw new Error('DATABASE_URL must include a database name');
  }

  const adminDbName = env.getDbAdminDatabase() ?? 'postgres';
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = `/${adminDbName}`;

  const adminPool = new Pool({
    connectionString: adminUrl.toString(),
    max: 1,
    connectionTimeoutMillis: env.getDbConnectionTimeoutMs(),
    query_timeout: env.getDbQueryTimeoutMs(),
    statement_timeout: env.getDbStatementTimeoutMs(),
    lock_timeout: env.getDbLockTimeoutMs(),
  });

  try {
    const exists = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      targetDbName,
    ]);
    if (exists.rowCount && exists.rowCount > 0) {
      return;
    }

    await adminPool.query(`CREATE DATABASE ${quoteIdentifier(targetDbName)}`);
    console.log(`Created database: ${targetDbName}`);
  } finally {
    await adminPool.end();
  }
};

const run = async () => {
  await withRetry('Database setup', ensureDatabaseExists);
  await withRetry('Database readiness check', async () => {
    await pool.query('SELECT 1');
  });
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('Migrations complete.');
  await pool.end();
};
// Pipeline performance fix: Revert if needed.

run().catch(async (error) => {
  console.error('Migration failed', error);
  await pool.end();
  process.exit(1);
});
