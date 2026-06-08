// Ensure dotenv does not log "injecting env" and tips when running tests.
process.env.DOTENV_CONFIG_QUIET = 'true';

// Silence app logging (pino) during tests so supertest error-handler tests don't dump JSON to stdout.
process.env.LOG_LEVEL = 'silent';

// Use a test database for tests. We should not be connecting to a live db for unit tests.
process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/soba_test';
