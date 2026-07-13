# Integration Test Examples

This folder holds cross-service integration tests at repo root (outside `backend` and `frontend`).

- Framework: Playwright
- Purpose: smoke-level examples for SOBA UI + API integration

## Setup (on demand)

These tests are **not** installed by the devcontainer — set them up only if you need them.
`integration/playwright` is a standalone npm project (its own lockfile), not part of the pnpm workspace.

### In the devcontainer

The image already includes Playwright's Linux runtime libraries (see `.devcontainer/Dockerfile`),
so you only install the npm dependencies and the Chromium binary:

```bash
npm ci --prefix integration/playwright
npm exec --prefix integration/playwright -- playwright install chromium
```

### Outside the devcontainer

System libraries aren't present, so let Playwright add them:

```bash
npm ci --prefix integration/playwright
npm exec --prefix integration/playwright -- playwright install --with-deps chromium
```

## Run

```bash
pnpm -C integration/playwright test
```

By default these tests target:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api/v1`

Override with environment variables:

- `E2E_BASE_URL`
- `E2E_API_BASE_URL`
