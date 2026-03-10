# Developer guide

For full-stack, backend, frontend, and integration developers working on SOBA. This doc is brief by design; more detail is in [In Detail](#in-detail) at the bottom where needed.

---

## How we work

Work from **branches** (not forks) off `develop`. Open a **pull request** into `develop`. Each PR can be deployed in isolation for review; deployment and review environments are described in a separate DevOps guide.

### Developer responsibilities / PR review readiness

Before requesting review, ensure:

- **All checks pass** — e.g. `pnpm check` at the repo root (type-check and lint for backend and frontend). See [pnpm](#pnpm) for root commands.
- **Unit tests** — New or changed behaviour is covered by tests. See [Backend](#backend) and [Frontend](#frontend) for how tests are run and where they live.

---

## Devcontainer

The project uses a VS Code devcontainer (`.devcontainer/`). Open the repo in VS Code and **Reopen in Container** so all tooling and env are consistent.

### Tools added to the OS

| Tool                          | Check / help               | Purpose                              |
| ----------------------------- | -------------------------- | ------------------------------------ |
| **Node.js** (24)              | `node --version`           | Runtime (npm + pnpm via corepack)    |
| **[pnpm](https://pnpm.io)**   | `pnpm --version`           | Monorepo package manager (see below) |
| **PostgreSQL client**         | `psql --version`           | DB client; connect to Postgres       |
| **mongosh**                   | `mongosh --version`        | MongoDB shell                        |
| **jq**                        | `jq --help`                | JSON on the CLI                      |
| **curl**                      | `curl --version`           | HTTP and downloads                   |
| **k6**                        | `k6 version`               | Load testing                         |
| **oc** (OpenShift CLI)        | `oc version`               | OpenShift / Kubernetes workflows     |
| **Docker** (Docker-in-Docker) | `docker --version`         | Sidecars, images, compose            |
| **GitHub CLI**                | `gh --version`             | `gh auth`, PRs, etc.                 |
| **kubectl**                   | `kubectl version --client` | Kubernetes CLI                       |
| **Helm**                      | `helm version`             | Kubernetes package manager           |

[Playwright](https://playwright.dev) (Chromium) is installed for the integration app via `pnpm -C integration exec playwright install chromium`. VS Code extensions: ESLint, Prettier, Docker, PostgreSQL, Kubernetes Tools.

### Host architecture (ARM vs AMD)

The devcontainer image is **multi-arch**: `linux/amd64` (e.g. Mac Intel, typical Linux) and `linux/arm64` (e.g. Mac Silicon). Both are supported. On ARM, the [Form.io](https://form.io) sidecar runs under amd64 emulation via an override (see below).

### Docker Compose (sidecar services)

From **inside** the devcontainer, start local backing services:

```bash
docker compose -f .devcontainer/docker-compose.yml up -d
```

This starts:

- **MongoDB** (port 27017) — used by Form.io
- **[PostgreSQL](https://www.postgresql.org) 17** (port 5432) — app DB
- **Form.io** (port 3001) — form runtime

**Inside the devcontainer** use `host.docker.internal` to reach these services (e.g. `mongodb://host.docker.internal:27017`, `postgresql://postgres:postgres@host.docker.internal:5432/postgres`, `http://host.docker.internal:3001`). The devcontainer is started with `--add-host=host.docker.internal:host-gateway` so that this hostname works on Linux as well as on Docker Desktop (Mac/Windows). On the host machine use `localhost` and the same ports. **Using the app from a browser on the host** (e.g. http://localhost:3000): the frontend example uses `NEXT_PUBLIC_SOBA_API_BASE_URL=http://localhost:4000/api/v1` so client-side API calls go to the forwarded backend; no change needed. Form.io login: `formio@localhost.com` / `formio`.

Optional: run DB migrations and seed via the `db-init` profile:

```bash
docker compose -f .devcontainer/docker-compose.yml --profile db-init up
```

### Mac Silicon (ARM)

On Apple Silicon, Form.io must run as amd64 (no native arm64 image). Use the **tasks** that apply the override (run **Dev Services: Up (arm64 override)** or **Dev Services: Up + DB Init (arm64 override)** from the Command Palette / Tasks), or run the same compose flags in a terminal. See [Launch & tasks](#launch--tasks) for the task list.

```bash
docker compose -f .devcontainer/docker-compose.yml -f .devcontainer/docker-compose.override.arm64.yml up -d
```

---

## pnpm

The repo is a **[pnpm](https://pnpm.io) workspace** (faster installs, shared store, strict dependency graph). Root `package.json` delegates to the `frontend` and `backend` workspaces.

**Why pnpm:** Single lockfile and workspace protocol for frontend + backend, disk-efficient store, and consistent installs across dev and CI.

### Root commands (workspace root)

| Command                                            | What it does                                                    |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm install`                                     | Install all workspace deps (run after clone / when deps change) |
| `pnpm build`                                       | `build:frontend` then `build:backend`                           |
| `pnpm build:frontend` / `pnpm build:backend`       | Build one app                                                   |
| `pnpm test`                                        | Run frontend and backend tests                                  |
| `pnpm test:frontend` / `pnpm test:backend`         | Test one app                                                    |
| `pnpm lint`                                        | Lint frontend and backend                                       |
| `pnpm lint:fix`                                    | Lint with auto-fix both                                         |
| `pnpm lint:frontend` / `pnpm lint:backend`         | Lint one app                                                    |
| `pnpm lint:fix:frontend` / `pnpm lint:fix:backend` | Lint fix one app                                                |
| `pnpm check`                                       | Type/style checks for both apps                                 |
| `pnpm check:frontend` / `pnpm check:backend`       | Check one app                                                   |

Package manager is pinned in `package.json` (`packageManager`: `pnpm@10.28.2`). The `integration` app lives outside the workspace and has its own `pnpm-lock.yaml`; use `pnpm -C integration <script>` for integration-specific commands.

---

## Launch & tasks

VS Code config lives in `.vscode/launch.json` and `.vscode/tasks.json`.

**Launch (`launch.json`):** Run and debug from the Run and Debug view.

| Configuration                 | Purpose                                                 |
| ----------------------------- | ------------------------------------------------------- |
| **SOBA Backend**              | Start backend dev server (`pnpm dev` in `backend/`)     |
| **SOBA Frontend**             | Start frontend dev server (`pnpm dev` in `frontend/`)   |
| **SOBA (Backend + Frontend)** | Compound: starts both                                   |
| **SOBA Frontend (Chrome)**    | Attach Chrome to frontend (URL `http://localhost:5173`) |

**Tasks (`tasks.json`):** Run from Command Palette → “Tasks: Run Task”.

| Task                                            | Purpose                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| **Dev Services: Up (arm64 override)**           | Start MongoDB, PostgreSQL, Form.io (with ARM override so Form.io runs as amd64) |
| **Dev Services: Up + DB Init (arm64 override)** | Same as Up, then run migrations + seed once                                     |
| **Dev Services: Down (arm64 override)**         | Stop and remove the dev service containers                                      |

Use the dev-services tasks on **Mac Silicon** so the override is applied; they work on amd64 as well. On other hosts you can instead run the `docker compose -f .devcontainer/docker-compose.yml up -d` command from the terminal (no override); or you can right-click the `docker-compose.yml` file and click `Compose Up`.

---

## Environment files

**Committed:** `*.env.example` and `*.env.local.example` (templates).

**Not committed:** `.env` and `.env.local` (active config, often contain secrets).

Example files are set up by default for **devcontainer usage** (e.g. `host.docker.internal`, local sidecars). When adding external services, use **development** endpoints and config where they exist — never production URLs or production-only settings in examples. **Never put secrets or passwords for external services in example files**; document the keys and put real values in `.env.local` (or equivalent local override) only.

The devcontainer **initialize** and **post-create** steps copy from example files only when the target does not exist (`cp -n`). **Post-start** refreshes `.env` from `.env.example` on each container start so base config stays in sync with the repo. **`.env.local` is never overwritten** — it is created once from `.env.local.example` and is up to you to maintain (secrets, credential overrides, local defaults). If you add secrets or change defaults in `.env.local`, keep it updated yourself; tooling will not replace it.

| App      | Base template                             | Local overrides (once, never overwritten)           |
| -------- | ----------------------------------------- | --------------------------------------------------- |
| Backend  | `backend/.env.example` → `backend/.env`   | `backend/.env.local.example` → `backend/.env.local` |
| Frontend | `frontend/.env.example` → `frontend/.env` | —                                                   |

**Loading:**

- Backend uses **[dotenv](https://github.com/motdotla/dotenv)**: it loads `.env` then `.env.local` (with `override: true`) so local values win.
- Frontend uses **[Next.js](https://nextjs.org) built-in** env loading (no extra lib): `.env`, `.env.local`, `.env.development` / `.env.production` are read automatically; expose client-side values via the `NEXT_PUBLIC_` prefix.

---

## Backend

**Stack:**

- **Runtime:** [Express](https://expressjs.com), TypeScript
- **DB:** [Drizzle](https://orm.drizzle.team) ORM, PostgreSQL (`pg`)
- **Auth:** Bearer-token APIs with Passport-backed stateless verification, IdP plugins (e.g. BC Gov SSO)
- **API docs:** OpenAPI/Swagger ([Zod](https://zod.dev) + `@asteasolutions/zod-to-openapi`)
- **Logging:** [Pino](https://getpino.io)

### Scripts

| Command                  | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `pnpm dev`               | TypeScript watch + nodemon; backend dev server (port 4000) |
| `pnpm build`             | Compile TypeScript to `dist/`                              |
| `pnpm serve`             | Build then run `node dist/app.js`                          |
| `pnpm start`             | Run `node dist/app.js` (assumes already built)             |
| `pnpm test`              | Run Jest unit tests                                        |
| `pnpm test:watch`        | Jest in watch mode                                         |
| `pnpm test:coverage`     | Jest with coverage report                                  |
| `pnpm lint` / `lint:fix` | ESLint; fix applies auto-fix                               |
| `pnpm type-check`        | `tsc --noEmit`                                             |
| `pnpm check`             | Type-check + lint (run before PR)                          |

Tests live under `backend/tests/`. See [In Detail — Testing](#testing) for approach and supertest usage.

### API layout

- **Base path:** `/api/v1`. All core domains and (when mounted) plugin APIs live under this prefix.
- **Public (no JWT):** `/api/v1/meta`, `/api/v1/health`. OpenAPI spec: `/api/docs/openapi.json`; Swagger UI: `/api/docs`.
- **Protected:** Routes under `/api/v1` use `checkJwt()` then `resolveActor`; core context (workspace, etc.) is required for domain routes. Admin routes under `/api/v1/admin` additionally require SOBA admin (`requireSobaAdmin`).

### Core domains

| API path                                           | Purpose                                                               | Access    |
| -------------------------------------------------- | --------------------------------------------------------------------- | --------- |
| `/api/v1/meta`                                     | Plugins, features, form-engines, build, frontend-config, codes, roles | Public    |
| `/api/v1/health`, `/api/v1/health/ready`           | Liveness and readiness                                                | Public    |
| `/api/v1/workspaces`, `/api/v1/workspaces/current` | List workspaces, current workspace                                    | Protected |
| `/api/v1/me`                                       | Current actor                                                         | Protected |
| `/api/v1/members`                                  | Workspace members                                                     | Protected |
| `/api/v1/forms`, `/api/v1/form-versions`, …        | Forms and form versions CRUD, save draft, publish                     | Protected |
| `/api/v1/submissions`, …                           | Submissions CRUD, save draft                                          | Protected |
| `/api/v1/admin`                                    | SOBA platform admins (list, add, remove)                              | Admin     |

### Plugin implementations

The backend uses a **plugin architecture** so that workspace resolution, form engines, auth (IdP), cache, message bus, and optional feature APIs can be swapped or extended without changing core. Plugins are discovered from `backend/src/plugins/` (each directory is a plugin module). Configuration is via env (e.g. which plugins are enabled, plugin-specific keys). For auth, Passport is now the protected-route entry point, but IdP plugins still provide provider-specific token verification and claim mapping. See [In Detail — Configuration of plugins and features](#configuration-of-plugins-and-features).

**Plugin types and current implementations:**

| Type                   | Purpose                                | Implementations                                                     |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| **Workspace resolver** | Resolve current workspace for requests | `personal-local`, `enterprise-cstar`                                |
| **Form engine**        | Render/store forms and submissions     | `formio-v5` (Form.io v5)                                            |
| **IdP (auth)**         | JWT validation, claim mapping          | `idp-bcgov-sso` (BC Gov Keycloak), `idp-github`                     |
| **Cache**              | Key-value cache                        | `cache-memory`; future: Redis                                       |
| **Message bus**        | Async messaging                        | `messagebus-memory`; future: Redis, NATS                            |
| **Feature API**        | Optional REST API per plugin           | e.g. `personal-local` (exposes `pluginApiDefinition` with basePath) |

Workspace and IdP plugins are ordered via env (`WORKSPACE_PLUGINS_ENABLED`, `IDP_PLUGINS`); the first successful resolver or IdP wins. For IdP auth, Passport orchestrates the ordered plugin attempts and the winning plugin still supplies the mapped identity used by core. Plugin APIs (from plugins that export both a workspace resolver and a feature API definition) are registered via `createPluginApiRouter()` and can be mounted under `/api/v1` when desired.

### Features

**Concept:** Features are optional capabilities that can be enabled or disabled per deployment. The `soba.feature` table holds a registry (code, name, description, version, **status**). Status values live in `soba.feature_status` (e.g. `enabled`, `disabled`, `experimental`, `deprecated`). Only features with status `enabled` are considered on for behaviour that checks feature flags. Codes and roles are extensible: **code tables** (e.g. `form_status`, `form_version_state`, `workspace_membership_role`, `role_status`) use `(code, source)` with `source = 'core'` or a feature code so features can add their own codes; **roles** can have `source = 'feature'` and `feature_code` set. Seed data inserts core codes and feature statuses; see [In Detail — Enable/Disable features, add codes + roles](#enabledisable-features-add-codes--roles-for-feature).

### Form engines and formio-v5

Form rendering and submission storage are delegated to a **form engine** plugin. The default is `formio-v5` (Form.io v5). The core stores form and submission metadata and draft state in PostgreSQL; the form engine (e.g. Form.io) holds the form definition and can persist submission payloads. The **FormioEngineAdapter** (`backend/src/plugins/formio-v5/`) talks to Form.io over HTTP. Config is via `PLUGIN_FORMIO_V5_*` (API base URL, admin/manager credentials, etc.). `FORM_ENGINE_DEFAULT_CODE` selects which engine to use; forms reference an engine code. See [In Detail — Configuration of plugins and features](#configuration-of-plugins-and-features).

### Outbox

To keep **transactions consistent across PostgreSQL and the form engine** (e.g. Form.io/Mongo), we use an **outbox pattern**: domain writes and a corresponding outbox event are used so a worker can reliably sync to the form engine and record the engine’s reference back in Postgres. We need this for **form_version** (sync schema → form engine, store `engine_schema_ref`) and **submission** (sync submission → form engine, store `engine_submission_ref`). See [In Detail — Outbox pattern](#outbox-pattern).

### Auth plugins and responsibilities

**IdP plugins** are responsible for: (1) validating the token (issuer, signature via JWKS or provider API), and (2) mapping claims to a normalised identity (subject, profile, optional `soba_admin`). Protected routes enter auth through Passport: `checkJwt()` calls `passport.authenticate(..., { session: false })`, and the composite Passport strategy tries each configured IdP in order. The first success still sets `req.idpPluginCode` and `req.authPayload`, and Passport also authenticates the request principal. **resolveActor** runs after `checkJwt()`: it uses the IdP’s claim mapper to get subject/profile, finds or creates the app user, sets `req.actorId` and `req.isSobaAdmin` (including refresh from IdP when the mapper returns `sobaAdmin`). So: Passport = “run the protected-route auth flow”; IdP = “is this token valid and who is it?”; core = “resolve to internal actor and admin flag”. IdPs are configured with `IDP_PLUGINS` (comma-separated) and plugin-specific env (e.g. `PLUGIN_BCGOV_SSO_JWKS_URI`). `session: false` is intentional because it keeps the auth path stateless, aligned with bearer-token APIs, easier to scale across instances, and compatible with multiple IdP plugins tried in order. See [In Detail — Auth flow](#auth-flow).

### Drizzle

Schema and queries live in TypeScript; migrations are SQL in `backend/drizzle/`. The app uses **drizzle-orm** at runtime; **drizzle-kit** (run via `npx` from `backend/`) handles schema introspection and migration generation. Config: `backend/drizzle.config.ts` (reads `DATABASE_URL` from `.env`).

| Command                    | Where      | Purpose                                                                   |
| -------------------------- | ---------- | ------------------------------------------------------------------------- |
| `pnpm db:migrate`          | `backend/` | Ensure DB exists, then run all pending migrations from `drizzle/`         |
| `pnpm db:seed`             | `backend/` | Seed data (run after migrate)                                             |
| `npx drizzle-kit generate` | `backend/` | Generate a new migration from schema changes (writes SQL into `drizzle/`) |
| `npx drizzle-kit studio`   | `backend/` | Open Drizzle Studio (DB GUI); requires `DATABASE_URL`                     |

Schema modules: `backend/src/core/db/schema/` (e.g. `core.ts`, `forms.ts`, `roles.ts`, `feature.ts`, `codes.ts`). After changing schema, run `drizzle-kit generate`, then `pnpm db:migrate` to apply.

---

## Frontend

**Stack:**

- **Runtime:** [Next.js](https://nextjs.org) 16, React 19, TypeScript
- **State:** [Redux Toolkit](https://redux-toolkit.js.org), react-redux, next-redux-wrapper
- **UI:** [BC Gov design system](https://github.com/bcgov/design-system) (`@bcgov/design-system-react-components`, `@bcgov/design-tokens`, `@bcgov/bc-sans`), [Tailwind CSS](https://tailwindcss.com), Bootstrap
- **Auth:** [Keycloak](https://www.keycloak.org) (keycloak-js) — BC Gov SSO
- **Testing:** [Vitest](https://vitest.dev)

### Scripts

| Command                         | Purpose                                |
| ------------------------------- | -------------------------------------- |
| `pnpm dev`                      | Next.js dev server (default port 3000) |
| `pnpm build`                    | Production build                       |
| `pnpm start`                    | Run production server (after build)    |
| `pnpm test` / `pnpm test:watch` | Vitest unit tests                      |
| `pnpm check`                    | Type-check + lint                      |

Tests live under `frontend/tests/`. See [In Detail — Testing](#testing).

### App structure and routing

- **App Router:** `app/` holds layouts and pages; `app/layout.tsx` is the root (html/body, globals.css); `app/[lang]/layout.tsx` wraps locale routes with `DictionaryProvider`, `Header`, and main content. The home page is `app/[lang]/page.tsx`; locale is required (e.g. `/en`, `/fr`).
- **Where code lives:** `app/` — pages, layouts, shared UI (`app/ui/`). `src/` — features (`src/features/`), shared API/config (`src/shared/`), app-level plugins and types (`src/app/`). `lib/` — Redux store, slices, hooks, runtime config loader. Path aliases: `@/lib`, `@/app`, `@/src`.
- **Adding pages:** Add under `app/[lang]/` (e.g. `app/[lang]/submit/page.tsx`) or new segments; use the locale layout for nav and dictionary.

### Runtime config and env

- **Env:** `NEXT_PUBLIC_SOBA_API_BASE_URL` is the fallback backend base URL (used when loading runtime config and for API calls until config is loaded). No other frontend env is required for basic run; see `.env.example`.
- **Runtime config:** The app loads config from the backend at `/meta/frontend-config` (Keycloak url/realm/clientId, api.baseUrl). It’s fetched when Keycloak initializes and cached; `getSobaApiBaseUrl()` and Keycloak settings come from this. See [In Detail — Runtime config (frontend)](#runtime-config-frontend).

### Auth (Keycloak)

- **keycloak-js:** Init with `check-sso` on load; login and logout trigger redirects. The Keycloak instance is kept in a module-level variable (not in Redux); Redux holds token, idTokenParsed, authenticated, initializing, error.
- **useKeycloak():** Exposes token, authenticated, login, logout, init. Header calls `init()` on mount and shows login/logout and display name based on auth state. Protected API calls pass `Authorization: Bearer ${token}`. See [In Detail — Auth flow (frontend)](#auth-flow-frontend).

### Current user (/me)

- After Keycloak is authenticated, the app loads the current user from the backend `GET /me` with the token. Result is stored in Redux (`currentUser` slice: data, status, error). `useCurrentUser()` returns that state; Header uses it to show the backend display name (and falls back to Keycloak id token claims if needed). Clear current user on logout. See [In Detail — Current user flow (frontend)](#current-user-flow-frontend).

### Redux store

- **Slices:** `keycloak` (token, auth state), `currentUser` (data from /me, status), `notification` (toast state). Store is created with next-redux-wrapper so it’s available in App Router; use `useAppDispatch` / `useAppSelector` (typed). See [In Detail — Redux store shape (frontend)](#redux-store-shape-frontend).

### API layer

- **Location:** `src/shared/api/sobaApi.ts`. Functions use `getSobaApiBaseUrl()` (from runtime config cache or env fallback). Protected endpoints take the token and send `Authorization: Bearer ${token}`. Examples: `fetchHealth()`, `fetchWorkspaces(token)`, `fetchCurrentUser(token)`. See [In Detail — API layer (frontend)](#api-layer-frontend).

### Plugins and home sections

- **AppPlugin:** id, featureFlag, order, getNavItem, HomeSection. The **registry** (`src/app/plugins/registry.ts`) lists plugins, filters by feature flag, and exposes `getNavigationItems()` (for Header nav) and `getHomeSections()` (for the home page). The workspaces plugin is the reference implementation. See [In Detail — Plugins (frontend)](#plugins-frontend).

### Feature flags

- **Env:** `NEXT_PUBLIC_FEATURE_FLAGS` and `NEXT_PUBLIC_DISABLED_FEATURE_FLAGS` (comma-separated). `src/shared/featureFlags/flags.ts` defines `FEATURE_KEYS` and `isFeatureEnabled(feature)`. Defaults: workspaces enabled when no explicit list is set. Plugins use a feature key to be included in nav and home sections. This needs to be restructured and should be driven by backend configuration (one source of truth for enabled features).

### i18n / dictionaries

- **Locales:** e.g. `en`, `fr` in `app/[lang]/dictionaries.ts`; `getDictionary(locale)` loads JSON (server-only). `DictionaryProvider` and `useDictionary()` give components access to the dictionary. Add or extend dictionary files and keys for new UI.

### UI and styling

- **BC Gov:** `@bcgov/design-system-react-components` (Button, Header, Text, etc.), design tokens, `@bcgov/bc-sans`. **Tailwind** and **Bootstrap** are available. Prefer design-system components and tokens for consistency.

### Forms

- Form-related UI lives under `app/ui/forms/` (e.g. ShareForm for manage flows). Form.io rendering is backend-driven; document when a form-render path is added.

### Testing

- **Vitest:** Unit tests in `frontend/tests/` (e.g. slices, config, URL helpers). Run with `pnpm test` or `pnpm test:watch`. See [In Detail — Testing](#testing).

### data-testid

- Integration tests (Playwright) select elements by `data-testid`. Add testids to interactive elements, landmarks, lists, and status/state UI as described in [Integration](#integration).

---

## Integration

Integration tests live in the **integration** app (repo root). An integration test specialist will own and expand this area; below is the minimum for running tests and for frontend support.

**Tech:** [Playwright](https://playwright.dev) (Chromium). Tests target the running frontend and backend (default: `http://localhost:3000`, `http://localhost:4000/api/v1`; override with `E2E_BASE_URL`, `E2E_API_BASE_URL`).

**Run tests:** From repo root, `pnpm -C integration test`. In the devcontainer, dependencies and Playwright Chromium are installed by post-create; otherwise run `pnpm -C integration install` and `pnpm -C integration exec playwright install chromium` once.

**Frontend and `data-testid`:** Integration tests locate elements by `data-testid`. Frontend developers **must** add `data-testid` to:

- **Interactive elements** — Buttons, links, form controls (inputs, selects, submit), and other clickable/navigable items that tests need to trigger.
- **Key landmarks** — Header, primary nav, main content sections, and page-level containers so tests can assert on visible regions.
- **Lists** — The list container and each list item (e.g. `data-testid="workspace-list"` and `data-testid="workspace-item-{id}"`) so tests can count or select items.
- **Status and state** — Loading, error, empty-state, and auth-related messages or indicators so tests can wait for or assert on UI state.

Use stable, semantic values (e.g. `workspace-page`, `login-button`, `workspace-item-${id}`). Avoid testids that encode only styling or position.

---

## In Detail

Optional deeper dives for onboarding: plugin/feature configuration, auth flow, feature and code management, and testing approach.

### Outbox pattern

We use a **transactional outbox** so that work that spans PostgreSQL and the form engine (e.g. Form.io/Mongo) is reliable: we persist the intent in our DB, then a worker processes it and calls the external service.

- **Table:** `soba.integration_outbox` — one row per event (topic, aggregateType, aggregateId, workspaceId, payload, status, attemptCount, nextAttemptAt, lastError). Status flows: pending → processing → done (or failed with backoff).
- **Flow:** When the app creates or updates a form version or submission that must exist in the form engine, it enqueues an event (via `QueueAdapter` → `DbOutboxQueueAdapter` → `enqueueOutboxEvent`). The **outbox worker** (`backend/src/core/workers/outboxWorker.ts`) polls, claims a batch (by status and nextAttemptAt), and passes each item to **SyncService**. SyncService resolves the form engine from the payload or aggregate, calls the form engine adapter (e.g. `createFormVersionSchema` or `createSubmissionRecord`), then updates the domain row in Postgres with the engine’s reference.
- **Where we need it:** We need the outbox for two aggregates so the engine ref is written back into our DB after the form engine has accepted the data:
  - **form_version.engine_schema_ref** — After a form version is created or published, we sync its schema to the form engine; the engine returns a reference (e.g. Form.io form path or ID). We store that in `form_version.engine_schema_ref` so we can render or submit against it.
  - **submission.engine_submission_ref** — After a submission is created, we provision a record in the form engine; the engine returns a reference. We store that in `submission.engine_submission_ref`.

Without the outbox, we would have to call the form engine synchronously inside the request and risk partial commits (Postgres updated but form engine unreachable, or the reverse). The outbox lets us commit the domain write and the outbox row together (or in a single logical step), and let the worker eventually sync and fill in the refs with retries and backoff.

### Configuration of plugins and features

- **Plugin discovery:** Plugins live under `backend/src/plugins/<pluginDir>/`. Each plugin module can export one or more of: `workspacePluginDefinition`, `formEnginePluginDefinition`, `pluginApiDefinition`, `idpPluginDefinition`, `cachePluginDefinition`, `messageBusPluginDefinition`. The registry validates with Zod and builds caches at startup.
- **Which plugins run:** Workspace resolvers: `WORKSPACE_PLUGINS_ENABLED` (comma-separated codes). IdP: `IDP_PLUGINS` (comma-separated; default from `IDP_PLUGIN_DEFAULT_CODE`). Cache / message bus: `CACHE_DEFAULT_CODE`, `MESSAGEBUS_DEFAULT_CODE`. Form engine: `FORM_ENGINE_DEFAULT_CODE`. Only plugins that are both discovered and listed in the relevant env are used. For auth, Passport uses the ordered IdP plugin list as its provider chain and stops at the first successful plugin. `WORKSPACE_PLUGINS_STRICT_MODE=true` fails startup if any enabled workspace plugin is missing.
- **Plugin config:** Each plugin gets a `PluginConfigReader` built from env with a prefix. Prefix is `PLUGIN_<NORMALIZED_CODE>_` (e.g. `PLUGIN_FORMIO_V5_API_BASE_URL`). The reader exposes `getRequired`, `getOptional`, `getBoolean`, `getNumber`, `getCsv`. Use `.env.example` and `.env.local` for secrets; document keys in examples only.
- **Features (DB):** The `soba.feature` and `soba.feature_status` tables are seeded via `pnpm db:seed`. Feature status (e.g. `enabled`/`disabled`) drives feature-flag behaviour. Roles and code tables support `source` and (for roles) `feature_code` so features can add codes and roles; see [Enable/Disable features, add codes + roles](#enabledisable-features-add-codes--roles-for-feature).

### Admins: table and IdP role mapping

- **Table:** `soba.soba_admin` stores SOBA platform admins (cross-workspace privileges). One row per user; `source` is either `idp` (granted from IdP token and refreshed on each login) or `direct` (manually added via admin API, survives IdP revoke). IdP-sourced rows store `identity_provider_code` (e.g. `bcgov-sso`) and `synced_at` for refresh. Direct grants are for users who must stay admin even when the IdP no longer reports the role.
- **Who decides “is this user an admin?”:** Each **IdP plugin** is responsible for reading the token and returning a boolean in the claim mapper (`sobaAdmin`). The core does not interpret JWT claims for admin; it trusts the IdP’s mapper. On login, if the mapper returns `sobaAdmin === true` or `false`, the core upserts or revokes the IdP-sourced row accordingly.
- **Example — idp-bcgov-sso:** Looks for the role `soba_admin` in the token. It checks (in order): top-level `roles`, `realm_access.roles`, and `client_roles`. If any of these arrays contain `soba_admin`, the mapper returns `sobaAdmin: true`. So granting a user the Keycloak client role `soba_admin` (or realm role) makes them a SOBA admin when using BC Gov SSO. Other IdPs (e.g. `idp-github`) can use different claim shapes; they just need to set `sobaAdmin` on the mapped result.

### Auth flow

1. **Request hits protected route** — Middleware order: `checkJwt()` then `resolveActor` (and for `/api/v1/admin`, `requireSobaAdmin`).
2. **checkJwt()** — Passport-backed auth middleware: it calls `passport.authenticate(..., { session: false })`, which runs the composite Passport strategy for protected API requests.
3. **Composite Passport strategy** — For each IdP in `IDP_PLUGINS`, run that IdP’s auth middleware (typically verify JWT with JWKS, issuer/audience, or validate against the provider API). First IdP that sets `req.idpPluginCode` and `req.authPayload` wins; if none succeed, respond 401. `session: false` is intentional because the API is bearer-token based, stays stateless across requests, scales cleanly across instances, and remains compatible with trying multiple IdP plugins in order.
4. **resolveActor** — Uses the winning IdP’s `claimMapper.mapPayload(req.authPayload)` to get subject, profile, and optional `sobaAdmin`. Calls `findOrCreateUserByIdentity(...)` to get or create the app user and set `req.actorId`. If the mapper returns `sobaAdmin === true` or `false`, upserts SOBA admin flag from IdP. Sets `req.isSobaAdmin` from DB. Any failure (e.g. unknown IdP, missing payload) goes to error handler.
5. **Downstream** — Handlers use `req.actorId` and `req.isSobaAdmin`; core context middleware can attach workspace etc. for domain routes.

Auth-related env: `IDP_PLUGINS`, `IDP_PLUGIN_DEFAULT_*`, and per-IdP `PLUGIN_<IDP>_*` (e.g. JWKS URI, issuer, audience). Protected API auth is Passport-backed and stateless; IdP plugins still perform provider-specific verification and claim mapping.

### Enable/Disable features, add codes + roles for feature

- **Feature status:** Rows in `soba.feature` have a `status` column; values come from `soba.feature_status` (e.g. `enabled`, `disabled`, `experimental`, `deprecated`). Application code uses `isFeatureEnabled(status)` (e.g. in `featureRepo`) so only `enabled` is treated as on. Seed inserts core feature rows and status codes; to add a feature, add a row to `feature` and (if needed) to `feature_status` (with `source = 'core'` or the feature code).
- **Adding codes:** Code tables (e.g. `form_status`, `form_version_state`, `workspace_membership_role`, `feature_status`, `outbox_status`) use composite `(code, source)`. Core uses `source = 'core'`. To add codes for a feature: insert into the appropriate code table with `source = '<feature_code>'`. Seed and app code should use constants from a single place (e.g. `backend/src/core/db/codes/`) for core codes.
- **Adding roles for a feature:** Table `soba.role` has `source` and `feature_code`. Core roles have `source = 'core'`. To add a feature-specific role: insert with `source = 'feature'` and `feature_code = '<feature_code>'`. Role listing/filtering (e.g. in meta or roleRepo) can filter by source or feature so the UI only shows applicable roles.

### App structure (frontend)

- **Root layout** (`app/layout.tsx`): Minimal — html/body, globals.css. No providers here so the tree stays simple.
- **Locale layout** (`app/[lang]/layout.tsx`): Wraps all `[lang]` routes. Loads dictionary server-side with `getDictionary(lang)`, provides `DictionaryProvider`, renders `Header` and `<main>{children}</main>`. All locale-aware pages live under `app/[lang]/`.
- **Folders:** `app/ui/` — shared presentational components (Header, forms, base). `lib/` — Redux store, slices, hooks, Keycloak init, runtime config loader (used by client components). `src/features/` — feature UI (e.g. workspaces list). `src/shared/` — API client, config, feature flags. `src/app/` — plugin types and registry. Use `@/lib`, `@/app`, `@/src` for imports.

### Runtime config (frontend)

- **Load:** `loadFrontendRuntimeConfig()` fetches `GET {baseUrl}/meta/frontend-config`; baseUrl comes from `NEXT_PUBLIC_SOBA_API_BASE_URL` until config is loaded. Called from Keycloak init (so the first client-side auth step triggers the fetch). Result is cached in memory; subsequent calls return the cache.
- **Shape:** Config includes `auth.keycloak` (url, realm, clientId, pkceMethod), `api.baseUrl`, `build` (name, version). Use `getSobaApiBaseUrl()` for API calls; use config.auth in Keycloak constructor.

### Auth flow (frontend)

1. **Page load** — A client component (e.g. Header) mounts and dispatches `initKeycloak()`. That thunk calls `loadFrontendRuntimeConfig()`, then creates Keycloak and runs `kc.init({ onLoad: 'check-sso', ... })`. No redirect if session exists; token and authenticated state are stored in Redux.
2. **Login** — User clicks login; dispatch `login()` which calls `kc.login()`. Keycloak redirects to IdP and back; on return, token is available and Redux is updated.
3. **After authenticated** — Header (or similar) sees `authenticated && token`, dispatches `loadCurrentUser(token)` to fill the currentUser slice, and shows display name and logout.
4. **Logout** — Dispatch `clearCurrentUser()` then `logout()`; Keycloak clears session and optionally redirects.

### Current user flow (frontend)

- When Keycloak reports authenticated and we have a token, dispatch `loadCurrentUser(token)`. The thunk calls `fetchCurrentUser(token)` (GET /me with Bearer token) and stores the result in `currentUser` slice (data, status: succeeded/failed).
- Header (and any component that needs the backend user) uses `useCurrentUser()` and compares `currentUser.token` to the current Keycloak token so we refetch when the token changes. On logout, dispatch `clearCurrentUser()` so no stale user data remains.
- Display name: prefer backend `/me` response (actor/profile); fall back to Keycloak id token claims (e.g. display_name) when current user is still loading or not yet fetched.

### Redux store shape (frontend)

- **keycloak:** token (string | undefined), idTokenParsed, authenticated (boolean), initializing, error. Keycloak instance is not in state (non-serializable); it’s held in a module variable and accessed via getKeycloakInstance().
- **currentUser:** data (CurrentUserResponse | null), status (idle | loading | succeeded | failed), error, lastToken. Cleared on logout; set by loadCurrentUser.fulfilled.
- **notification:** Toast/notification state (used by useNotificationStore and NotificationToast). Use useAppDispatch / useAppSelector with RootState for typing.

### API layer (frontend)

- **Base URL:** From `getSobaApiBaseUrl()` in `src/shared/config/runtimeConfig.ts` (cached config or `NEXT_PUBLIC_SOBA_API_BASE_URL`).
- **Pattern:** Protected calls take the token and set `Authorization: Bearer ${token}`. Use fetch with cache: 'no-store' for dynamic data. Types for responses live in sobaApi.ts (e.g. WorkspacesResponse, CurrentUserResponse). Add new endpoints as functions that call getSobaApiBaseUrl() and pass the token where required.

### Plugins (frontend)

- **Adding a plugin:** (1) Define a feature key in `src/shared/featureFlags/flags.ts` (FEATURE_KEYS and defaults). (2) Create a feature folder under `src/features/<name>/` with a component for the home section and a `plugin.tsx` (or similar) that exports an `AppPlugin`: id, featureFlag, order, getNavItem, HomeSection. (3) Register the plugin in `src/app/plugins/registry.ts` (add to the allPlugins array). Nav and home sections will include it when the feature flag is enabled.
- **getNavItem** returns { id, href, label } for the Header nav; href typically includes locale (e.g. `/${locale}/`). **HomeSection** is the React component rendered on the home page for this plugin.

### Testing

- **Goals:** Test **outcomes and logic** with minimal mocks. Prefer unit tests for services and pure functions; use **supertest** for a small set of **basic API scenarios** (e.g. validation, error responses). Leave broader **API-level and E2E** coverage to the **integration** app (Playwright) to reduce reliance on mocking infrastructure (DB, Form.io, IdP).
- **Backend:** Jest; tests under `backend/tests/` (e.g. `tests/core/api/shared/validation.test.ts`, `validation.supertest.test.ts`). Structure mirrors `src/` where it helps. Mock only what’s necessary (e.g. env reader, single adapter); avoid mocking the whole container or DB when a focused unit test will do.
- **Supertest:** Used for route-level checks without starting the full app: build a minimal Express app that mounts the middleware or router under test, then `request(app).get(...).set(...).send(...)` and assert status and body. Example: `validateRequest` middleware — create an app that uses it and assert 400 on invalid body/params/query and 200 with parsed values on valid input. Keep supertest tests to **basic scenarios** (validation, auth rejection, success path for one route); deeper flows belong in integration tests.
- **Frontend:** Vitest (see [Frontend](#frontend)). Integration: Playwright in the `integration` app for full API and UI flows.
