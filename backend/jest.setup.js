// Ensure dotenv does not log "injecting env" and tips when running tests.
process.env.DOTENV_CONFIG_QUIET = 'true';

// Silence app logging (pino) during tests so supertest error-handler tests don't dump JSON to stdout.
process.env.LOG_LEVEL = 'silent';
