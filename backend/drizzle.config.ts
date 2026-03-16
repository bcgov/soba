import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

const quiet = process.env.NODE_ENV === 'test';
dotenv.config({ path: '.env', quiet });
dotenv.config({ path: '.env.local', override: true, quiet });

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;

  const host = process.env.DB_HOST?.trim();
  const portRaw = process.env.DB_PORT?.trim();
  const port = portRaw !== undefined && portRaw !== '' ? Number(portRaw) : undefined;
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME?.trim();

  if (
    host &&
    port !== undefined &&
    !Number.isNaN(port) &&
    user &&
    password !== undefined &&
    dbName
  ) {
    return `postgres://${user}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
  }

  return 'postgres://postgres:postgres@localhost:5432/soba';
}

const databaseUrl = getDatabaseUrl();

export default defineConfig({
  schema: './src/core/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
