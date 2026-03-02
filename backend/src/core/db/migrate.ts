// Must be first: initializes .env + .env.local for this process.
import { env } from '../config/env';
env.loadEnv();

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { db, pool } from './client';

const quoteIdentifier = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

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
  await ensureDatabaseExists();
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('Migrations complete.');
  await pool.end();
};

run().catch(async (error) => {
  console.error('Migration failed', error);
  await pool.end();
  process.exit(1);
});
