import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

const quiet = process.env.NODE_ENV === 'test';
dotenv.config({ path: '.env', quiet });
dotenv.config({ path: '.env.local', override: true, quiet });

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/soba';

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
