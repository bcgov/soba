# Integration Test Examples

This folder holds cross-service integration tests at repo root (outside `backend` and `frontend`).

- Framework: Playwright
- Purpose: smoke-level examples for SOBA UI + API integration

## Run in devcontainer (recommended)

Devcontainer setup now prepares integration tests automatically:

- `.devcontainer/post-create.sh` installs integration dependencies with `pnpm`
- `.devcontainer/post-create.sh` installs Playwright Chromium
- `.devcontainer/Dockerfile` includes required Linux runtime libraries for Playwright

After the container is created/rebuilt, tests should be ready to run:

```bash
pnpm -C integration test
```

## Run manually (outside devcontainer)

Install dependencies and browser once:

```bash
pnpm -C integration install --frozen-lockfile
pnpm -C integration exec playwright install chromium
```

Run tests:

```bash
pnpm -C integration test
```

By default these tests target:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api/v1`

Override with environment variables:

- `E2E_BASE_URL`
- `E2E_API_BASE_URL`
