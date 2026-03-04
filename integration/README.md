# Integration Test Examples

This folder holds cross-service integration tests at repo root (outside `backend` and `frontend`).

- Framework: Playwright
- Purpose: smoke-level examples for SOBA UI + API integration

## Run locally

```bash
cd integration
npm install
npx playwright test
```

By default these tests target:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api/v1`

Override with environment variables:

- `E2E_BASE_URL`
- `E2E_API_BASE_URL`
