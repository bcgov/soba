# Developer Getting Started

For developers joining the project. Read [DEVELOPER.md](./DEVELOPER.md) first.

## State of the union: March 9 2026...

We map what’s built and working, what exists but isn’t wired up, and what’s schema or placeholder only. Treat the codebase as a starting point: if you see a simpler or more scalable approach that keeps flexibility, we want to hear it.

This doc isn’t complete. I may have missed things or misstated how ideas, code, or files work — I was trying a lot of approaches and iterating. If something doesn’t match what you see in the repo, the code is probably right and flag the doc. Or simply raise it and we will figure it out together!

---

## Table of Contents

1. [Stack checklist for adding code](#stack-checklist-for-adding-code)
2. [Environment Variables](#environment-variables)
3. [Database](#database)
4. [Auth](#auth)
5. [Workspace](#workspace)
6. [Project Structure](#project-structure)
7. [Backend](#backend)
   - [Request Pipeline](#request-pipeline)
   - [Plugin Architecture](#plugin-architecture)
   - [Features](#features)
   - [Meta API](#meta-api)
   - [Form Engine](#form-engine)
   - [Outbox Pattern](#outbox-pattern)
   - [Cache](#cache)
   - [Message Bus](#message-bus)
   - [API Overview](#api-overview)
   - [Forms and Submissions](#forms-and-submissions)
8. [Error Handling](#error-handling)
9. [Logging](#logging)
10. [Rate Limiting](#rate-limiting)
11. [Testing](#testing)
12. [Frontend](#frontend)
13. [Discussion Points](#discussion-points)

---

# Stack checklist for adding code

When estimating or implementing a new piece of functionality, use this as a map of what you’ll touch. Before diving into the stack, have a **design-time discussion** about where the new code belongs.

## Design-time: core, plugin, or feature?

- **Core** — Behaviour that every deployment needs and that lives in `backend/src/core/` (or the frontend equivalent). Examples: workspace resolution, auth, forms/submissions domain, outbox.
- **Plugin** — Swappable or extensible behaviour: workspace resolvers, IdP, form engine, cache, message bus, or an optional REST API mounted under `/api/v1`. Lives in `backend/src/plugins/<name>/`; selected and configured via env. Use when the capability might be replaced (e.g. different IdP or form engine) or when it’s optional and self-contained.
- **Feature** — Optional capability toggled per deployment via `soba.feature` (status `enabled`/`disabled`). Can add its own codes and roles with `source = 'feature'` and `feature_code`. Use when the capability is optional but not a full plugin (e.g. a new workflow or UI area that can be turned off without changing resolvers or engines).

Deciding core vs plugin vs feature affects where code lives, how it’s configured, and whether you add env, feature rows, or plugin exports. See [Plugin Architecture](#plugin-architecture) and [Features](#features) for details.

## Stack checklist (typical new API + UI)

Use this when scoping or estimating. Not every item applies to every change.

| Layer                  | What you’ll typically touch                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend**            | Zod schema(s) for request/response → `validateRequest` → controller → API service → domain service → repo. Optionally: new or changed tables → schema in `backend/src/core/db/schema/` → `drizzle-kit generate` → migration → `db:migrate` (and seed if adding codes/roles). If the flow spans Postgres and the form engine: outbox enqueue in the service and (once wired) outbox worker + form engine adapter. |
| **Route registration** | Add or extend a router; ensure it’s mounted in the app (e.g. `app.ts`) with the right auth and context middleware.                                                                                                                                                                                                                                                                                               |
| **Frontend**           | Page under `app/[lang]/` (locale layout, dictionary keys if needed); components (e.g. under `app/ui/` or `src/features/`); API client in `src/shared/api/sobaApi.ts` (token, types); Redux slice/thunk if you need client state; nav item if the plugin exposes `getNavItem`.                                                                                                                                    |
| **Testids**            | Add `data-testid` to new interactive elements, landmarks, lists, and status/state so integration tests can target them (see [DEVELOPER.md](./DEVELOPER.md) — Integration).                                                                                                                                                                                                                                       |
| **Tests**              | Backend: unit tests for new logic (e.g. services, helpers); optionally a small Supertest for a new route. Frontend: Vitest for new slices or utilities. Integration: Playwright if you add a new flow; requires the testids above.                                                                                                                                                                               |
| **Config / env**       | New env vars → document in `.env.example`, use in core via `env.ts` or in plugins via `PluginConfigReader`; if deployed via Helm, update charts to match.                                                                                                                                                                                                                                                        |
| **PR readiness**       | `pnpm check` (type-check + lint), tests passing, before requesting review.                                                                                                                                                                                                                                                                                                                                       |

---

# Environment Variables

> **Pipeline / CICD:** The current [helm charts](https://github.com/bcgov/helm-charts/tree/master/charts/soba) don’t match this env set. We need to sync them.

### Loading

The backend uses `dotenv` to load env in a specific order (last wins):

1. `backend/.env` — base config (kept in sync with `.env.example` on each container start)
2. `backend/.env.local` — local overrides and secrets (created once, never overwritten by tooling)

`loadEnv()` in `backend/src/core/config/env.ts` runs once on import. In tests you can pass a fake env into `createEnvReader()` so tests don’t depend on the real environment.

### Core env reader

Use the `env` object in `env.ts` for all core config; don’t read `process.env` directly. It gives you typed accessors (`getRequiredEnv`, `getOptionalEnv`, `getBooleanEnv`, etc.) and named helpers like `env.getDatabaseUrl()`. Auth vars live in `authEnv.ts`.

### Plugin and feature config

Plugins use a `PluginConfigReader` from `createPluginConfigReader(pluginCode)`. Env keys are namespaced as `PLUGIN_<NORMALIZED_CODE>_` (e.g. `formio-v5` → `PLUGIN_FORMIO_V5_<KEY>`). Same typed accessors as core. Core never reads plugin-specific env; each plugin owns its config.

---

# Database

PostgreSQL via **Drizzle ORM**. All tables live in the `soba` Postgres schema (never `public`). Schema is defined in TypeScript; migrations are generated SQL files in `backend/drizzle/`.

## Schema modules

Each file in `backend/src/core/db/schema/` owns a slice of the schema:

| File                    | Tables                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core.ts`               | `identity_provider`, `app_user`, `user_identity`, `workspace`, `workspace_membership`, `workspace_group`, `workspace_group_membership`, `soba_admin` |
| `forms.ts`              | `form`, `form_version`, `form_version_revision`                                                                                                      |
| `roles.ts`              | `role`, `role_status`                                                                                                                                |
| `codes.ts`              | `form_status`, `form_version_state`, `workspace_membership_role`, `workspace_membership_status`, `outbox_status`                                     |
| `feature.ts`            | `feature`, `feature_status`                                                                                                                          |
| `integration.ts`        | `integration_outbox`                                                                                                                                 |
| `plugins.enterprise.ts` | Enterprise-specific tables (e.g. ministry/group bindings)                                                                                            |

## Helpers

**`audit.ts`** — Three reusable column factories spread into table definitions:

- `idColumn()` — UUID primary key with UUIDv7 default
- `auditColumns()` — `created_at`, `updated_at`, `created_by`, `updated_by`
- `softDeleteColumns()` — `deleted_at`, `deleted_by` (opt-in, not on every table)

**`codes.ts`** — Code/lookup tables use the same `codeColumns()` shape: `(code, source)` PK, `display`, `sort_order`, `is_active`. `source` is `'core'` or a feature code so features can add rows without touching core.

**`codes/index.ts`** — All code string constants live here (`Roles`, `WorkspaceMembershipRole`, etc.). Import from here; don’t use raw strings in app logic.

## Repos

Each repo (`backend/src/core/db/repos/`) owns queries for one domain. Key functions:

| Repo              | Key functions                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `membershipRepo`  | `findOrCreateUserByIdentity`, `actorBelongsToWorkspace`, `getWorkspaceForUser`, `listWorkspacesForUser`, `listMembersForWorkspace`, `invalidateMembershipCache`      |
| `workspaceRepo`   | `ensureHomeWorkspace`, `getWorkspaceOwnersGroup`, `canManageWorkspaceOwners`                                                                                         |
| `formRepo`        | `createForm`, `getFormById`, `listFormsForWorkspace`, `updateForm`, `markFormDeleted`, `getFormEngineCodeForForm`                                                    |
| `formVersionRepo` | `createEmptyFormVersionDraft`, `getFormVersionById`, `listFormVersionsForWorkspace`, `updateFormVersionDraft`, `appendFormVersionRevision`, `markFormVersionDeleted` |
| `submissionRepo`  | `createEmptySubmission`, `getSubmissionById`, `listSubmissionsForWorkspace`, `updateSubmissionDraft`, `appendSubmissionRevision`, `markSubmissionDeleted`            |
| `outboxRepo`      | `enqueueOutboxEvent`, `claimOutboxBatch`, `markOutboxSucceeded`, `markOutboxFailed`                                                                                  |
| `sobaAdminRepo`   | `isSobaAdmin`, `upsertSobaAdminFromIdp`, `addDirectSobaAdmin`, `removeDirectSobaAdmin`, `listSobaAdmins`                                                             |
| `roleRepo`        | `listRoles`, `getRoleByCode`                                                                                                                                         |
| `featureRepo`     | `listFeatures`, `getFeatureByCode`, `isFeatureEnabled`                                                                                                               |
| `appUserRepo`     | `findAppUserById`, `findUserIdByEmail`                                                                                                                               |
| `identityLookup`  | `findUserIdByIdentity`                                                                                                                                               |

Repos are plain async functions (no classes, no active record). They take typed inputs and return rows; the service layer does the orchestration.

> **Pagination:** The cursor helpers (`encode/decode`, `buildNextCursor`, `resolveCursorMode`) are implemented and tested in `pagination.test.ts`; all five list repos use them. The actual paginated SQL in the repos (the `lt(id, ...)` / `lt(updatedAt, ...)` conditions) has no tests — that needs a real DB. Before we rely on list endpoints, validate cursor behaviour (first page, next page, boundaries) via integration tests or a manual pass.

## Codes — seeded vs. active in logic

Code constants live in `backend/src/core/db/codes/index.ts` and are seeded with `pnpm db:seed`. The table below shows which ones the app actually uses in logic.

| Constant                    | Codes                                               | Seeded         | Active in logic                                                                                                                                 |
| --------------------------- | --------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Roles`                     | `workspace_owner`, `form_owner`                     | Yes            | `workspace_owner` — used in group creation and `canManageWorkspaceOwners`; `form_owner` — seeded only                                           |
| `RoleStatus`                | `active`, `deprecated`                              | Yes            | `active` — used when seeding and filtering roles                                                                                                |
| `WorkspaceMembershipRole`   | `owner`, `admin`, `member`, `viewer`                | Yes            | `owner` — set on auto-home workspace creation and filtered in membership queries; `admin` / `member` / `viewer` — seeded only, **under review** |
| `WorkspaceMembershipStatus` | `active`, `inactive`, `pending`                     | Yes            | `active` — filtered on in every membership query; `inactive` / `pending` — seeded only, no flow sets them                                       |
| `WorkspaceMembershipSource` | `auto_home`                                         | No (code only) | Used in `ensureHomeWorkspace` to tag and identify auto-created memberships                                                                      |
| `FormStatus`                | `active`, `archived`, `deleted`                     | Yes            | `active` on create; `deleted` on soft-delete; `archived` — seeded only                                                                          |
| `FormVersionState`          | `draft`, `published`, `deleted`                     | Yes            | `draft` on create; `published` on publish; `deleted` on soft-delete                                                                             |
| `OutboxStatus`              | `pending`, `processing`, `done`                     | Yes            | All three used in outbox worker flow — `pending` on enqueue, `processing` on claim, `done` on success                                           |
| `FeatureStatus`             | `enabled`, `disabled`, `experimental`, `deprecated` | Yes            | `enabled` — checked by `isFeatureEnabled()`; others seeded and available but only `enabled` triggers active behaviour                           |

**Features seeded** (in `soba.feature`): `form-versions` (enabled), `submissions` (enabled), `meta` (enabled). These are the only feature rows; no feature-specific roles or code extensions exist yet.

**System user:** The seed also creates a `system` IdP and a `SOBA System` app user (`SOBA_SYSTEM_SUBJECT`). We use it for audit stamps when there’s no human actor.

> **Important:** Roles and codes are placeholders. We need a proper catalog before building enforcement. See [Discussion Points — Roles and codes catalog](#roles-and-codes-catalog).

---

# Auth

## Admin

SOBA admins are platform-wide. You can get there two ways:

- **IdP-granted:** The IdP’s claim mapper returns `sobaAdmin: true`. For `idp-bcgov-sso` that means the `soba_admin` Keycloak role (in `realm_access.roles`, `roles`, or `client_roles`). We upsert the `soba_admin` row on every login and revoke it when the IdP stops reporting the role.
- **Direct grant:** An existing SOBA admin adds you via `POST /api/v1/admin`. That grant sticks even if the IdP revokes the role; it’s only removed with `DELETE /api/v1/admin/:userId`.

The `soba_admin` table stores the source (`idp` or `direct`). `/api/v1/admin` is the only route group guarded by `requireSobaAdmin`.

## Sign in and Context

### Done

Protected routes go through three steps:

1. **`checkJwt()`** — Tries each IdP in `IDP_PLUGINS` order. Each validates the JWT (JWKS, issuer, audience). First success sets `req.idpPluginCode` and `req.authPayload`; otherwise 401.

2. **`resolveActor`** — The winning IdP’s `claimMapper` turns claims into an internal actor. We call `findOrCreateUserByIdentity` (creates `app_user` on first login) and, if the mapper says `sobaAdmin`, upsert or revoke the `soba_admin` row. Sets `req.actorId` and `req.isSobaAdmin`.

3. **`coreContextMiddleware`** — Workspace resolvers figure out which workspace the request is for. We check the actor has an active membership there (cached as `membership:{workspaceId}:{userId}`) and set `req.coreContext`.

### Not Done

- **No role-based authorization middleware** — `coreContext` confirms the actor is a workspace member, but no middleware or guard checks whether their membership role (`owner`, `admin`, `member`, `viewer`) permits the action being taken
- **`canManageWorkspaceOwners`** exists in `workspaceRepo.ts` and works correctly, but is not called from any route handler yet
- **Workspace membership roles are under review** — the four role codes (`owner`, `admin`, `member`, `viewer`) are seeded and defined, but the model may change before any enforcement logic is written. Do not build on top of these values until the role design is settled
- No group-level authorization — group membership exists in the DB (via `workspace_group_membership`) but is not checked in any request path beyond the owner-group query in `workspaceRepo.ts`
- **No API key or service-account access** — only human IdP JWTs work today. External systems and scripts can’t call the API. See [Discussion Points — API access for external clients](#api-access-for-external-clients).
- **How workspace/tenant context is determined is undefined** — we don’t yet know how personal or enterprise resolvers will decide which workspace a request belongs to, or how the user’s selection is communicated. For personal-local we need to decide: does switching workspace set a cookie, a header, or do we mint a token? See [Discussion Points — Workspace / tenant context](#workspace-tenant-context).

---

# Workspace

A workspace is the tenancy boundary: forms, submissions, and members all belong to one. We resolve it on every protected request in `coreContextMiddleware` (see Auth).

We have two resolver plugins, chosen via `WORKSPACE_PLUGINS_ENABLED`:

- **`personal-local`** — resolves a personal workspace for the actor; auto-creates it on first login via `ensureHomeWorkspace`
- **`enterprise-cstar`** — resolves workspace from an enterprise context (e.g. a ministry or team); intended for multi-user shared workspaces

### Done

- Personal workspace auto-created on first login (workspace + membership + owners group + group membership, all in one step)
- `GET /api/v1/workspaces` — list workspaces the actor belongs to, paginated, filterable by kind and status
- `GET /api/v1/workspaces/current` — returns the workspace resolved for the current request
- `GET /api/v1/members` — list members of the current workspace, filterable by role and status
- Schema fully in place: `workspace`, `workspace_membership`, `workspace_group`, `workspace_group_membership`

## Ownership

Ownership is modelled with two complementary pieces:

- **Membership role `owner`** — set on the `workspace_membership` row when a user is added as an owner
- **Platform role `workspace_owner`** — assigned to a `workspace_group` named `'Workspace owners'`; membership in that group is what the authorization check (`canManageWorkspaceOwners`) actually queries

Right now, first login runs `ensureHomeWorkspace` and every user gets a personal workspace and owner role with no gate.

> **Important:** That’s a placeholder. We need a workspace-creation gate before production. See [Discussion Points — Workspace creation gate](#workspace-creation-gate).

### Not Done

- **Enterprise** (`enterprise-cstar`): plugin can resolve a workspace but member sync, group bindings (`external_group_id`), and IdP group mapping aren’t built.
- No `POST /workspaces` or workspace management API.
- No member management — no invite/add/update role/remove; invitation columns exist in schema but unused.
- No group management API; we only auto-create the owners group.
- `pending` and `inactive` membership statuses are seeded but no flow sets them.

---

# Project Structure

We use a **pnpm workspace** monorepo. In `pnpm-workspace.yaml` we declare two packages: `backend/` (Express, Drizzle, TypeScript) and `frontend/` (Next.js, React, Redux). The `integration/` app (Playwright e2e tests) sits at the repo root with its own `package.json` and isn’t in the workspace. No shared packages yet — no `@soba/shared`; types and constants aren’t shared between frontend and backend.

---

# Backend

## Request Pipeline

Every domain route follows the same layered pattern:

```
route → validateRequest → controller → service → repo → DB
```

**`validateRequest(schemas)`** (`validation.ts`) — Validates `body`, `params`, and/or `query` with Zod. Fail → `400` and `{ error, details[] }`. Success → we overwrite `req.body` / `params` / `query` with the parsed values so handlers see typed data.

**`asyncHandler(fn)`** (`asyncHandler.ts`) — Wraps async controllers so rejections go to `next(error)`. No try/catch in handlers; `coreErrorHandler` deals with everything.

**Controller** — Pulls `req.coreContext`, calls the API service, returns the response. No business logic.

**API service** (each domain has a `serviceFactory.ts`) — Calls domain services, maps rows to DTOs, does cursor encoding for lists. Created by a factory that gets the domain services it needs.

**Domain service** (`backend/src/core/services/`) — Where the rules live: preconditions, repo coordination, outbox enqueue, form engine. `FormService`, `FormVersionService`, `SubmissionService` own behaviour; repos are just data.

**Repo** — Data access only (see [Repos](#repos)).

Example route:

```typescript
router.post(
  "/forms",
  validateRequest({ body: CreateFormBodySchema }),
  createForm,
);
```

(`createForm` is just the controller wrapped in `asyncHandler`.)

### Revision tables

Form versions and submissions both use a **main row + revision table**: the main row holds current state; each save appends an immutable revision row with `revisionNo`, `eventType`, `changedBy`, `changeNote`, and before/after engine refs. So we get a full audit trail without overwriting. `POST /:id/save` appends a revision and bumps `currentRevisionNo` in one go. What should live in these tables once we have real content is still open — see [Discussion Points — Revision tables](#revision-tables--current-state-vs-history).

## Plugin Architecture

We use a plugin system for workspace resolution, auth, form engines, cache, message bus, and optional feature APIs so we can swap or extend without changing core. Same pattern everywhere: implement the interface, export the right constant from the plugin’s `index.ts`, and the registry picks it up.

### Discovery and loading

At startup, [`PluginRegistry.ts`](./backend/src/core/integrations/plugins/PluginRegistry.ts) scans every directory under `backend/src/plugins/`. For each directory it attempts a `require()` and inspects the exports for known named exports, validating each with Zod:

| Export name                  | Plugin type                                        | Selected by env                                            |
| ---------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `workspacePluginDefinition`  | Workspace resolver                                 | `WORKSPACE_PLUGINS_ENABLED` (comma-separated, ordered)     |
| `idpPluginDefinition`        | Identity provider (JWT validation + claim mapping) | `IDP_PLUGINS` (comma-separated, ordered)                   |
| `formEnginePluginDefinition` | Form engine adapter                                | `FORM_ENGINE_DEFAULT_CODE`                                 |
| `cachePluginDefinition`      | Cache adapter                                      | `CACHE_DEFAULT_CODE`                                       |
| `messagebusPluginDefinition` | Message bus adapter                                | `MESSAGEBUS_DEFAULT_CODE`                                  |
| `pluginApiDefinition`        | Optional REST API mounted under `/api/v1`          | Enabled automatically when the workspace plugin is enabled |

A single plugin directory can export more than one type — for example `personal-local` exports both a workspace resolver and a feature API.

### Selection and priority

- **Workspace resolvers** — all plugins listed in `WORKSPACE_PLUGINS_ENABLED` are activated. They are sorted by `priority` and tried in order on each request; the first resolver that returns a workspace wins.
- **IdP plugins** — tried in `IDP_PLUGINS` order; first successful JWT validation wins.
- **Cache, message bus, form engine** — single active instance selected by code; the registry creates it lazily on first use.

If `WORKSPACE_PLUGINS_STRICT_MODE=true`, startup fails if any enabled workspace plugin is not found. Otherwise a warning is logged.

### Interfaces — the contract between core and plugins

Each plugin type has a TypeScript interface (or definition type) that is the contract a plugin must satisfy. These all live under `backend/src/core/`:

| Plugin type         | Interface file                                                                      |
| ------------------- | ----------------------------------------------------------------------------------- |
| Workspace resolver  | `integrations/workspace/WorkspaceResolver.ts`                                       |
| IdP                 | `auth/IdpPlugin.ts`                                                                 |
| Form engine adapter | `integrations/form-engine/FormEngineAdapter.ts` and `FormEnginePluginDefinition.ts` |
| Cache adapter       | `integrations/cache/CacheAdapter.ts`                                                |
| Message bus adapter | `integrations/messagebus/MessageBusAdapter.ts`                                      |
| Feature API         | `integrations/plugins/FeatureApiDefinition.ts`                                      |

To add a plugin: implement the interface, export the right constant from `index.ts`, and the registry picks it up.

### Plugin config

See [Environment Variables — Plugin and feature config](#plugin-and-feature-config). Each plugin receives a scoped `PluginConfigReader`; core never reads plugin-specific env.

### Current plugins

| Directory           | Normalized code prefix      | Types exported                  | Notes                                                          |
| ------------------- | --------------------------- | ------------------------------- | -------------------------------------------------------------- |
| `personal-local`    | `PLUGIN_PERSONAL_LOCAL_`    | Workspace resolver, Feature API | Personal workspace; auto-creates home workspace on first login |
| `enterprise-cstar`  | `PLUGIN_ENTERPRISE_CSTAR_`  | Workspace resolver              | Enterprise/ministry workspace; group sync not yet implemented  |
| `idp-bcgov-sso`     | `PLUGIN_IDP_BCGOV_SSO_`     | IdP                             | BC Gov Keycloak SSO; maps `soba_admin` Keycloak role           |
| `idp-github`        | `PLUGIN_IDP_GITHUB_`        | IdP                             | GitHub OAuth; alternative IdP                                  |
| `formio-v5`         | `PLUGIN_FORMIO_V5_`         | Form engine                     | Form.io CE; no API client yet                                  |
| `cache-memory`      | `PLUGIN_CACHE_MEMORY_`      | Cache                           | In-process; default. Redis plugin not yet written              |
| `messagebus-memory` | `PLUGIN_MESSAGEBUS_MEMORY_` | Message bus                     | In-process; default. Redis/NATS plugin not yet written         |

## Features

Features are optional capabilities toggled per deployment in `soba.feature`. Each row has `code`, `name`, `description`, `version`, and `status` (from `feature_status`: enabled, disabled, experimental, deprecated).

### Done

- `soba.feature` and `soba.feature_status` tables exist and are seeded
- Three core features seeded: `form-versions` (enabled), `submissions` (enabled), `meta` (enabled)
- `featureRepo` exposes `listFeatures()`, `getFeatureByCode()`, and `isFeatureEnabled(status)`
- `GET /api/v1/meta` returns all features and their status — this is the backend source of truth
- Roles and code tables support `source = 'feature'` and `feature_code` so a feature can register its own roles and codes without touching core rows

### Not Done

- No route, service, or repo actually gates on features. We only call `isFeatureEnabled()` in the meta service and in `roleService` (for feature-linked roles).
- Frontend still reads flags from env (`NEXT_PUBLIC_FEATURE_FLAGS`), not from `/meta` — see [Frontend](#frontend).

### Adding a feature

1. Insert a row in `soba.feature` in `seed.ts` (unique `code`, `name`, `status`).
2. Add feature-specific codes to the right code table with `source = '<feature_code>'`.
3. Add feature-specific roles in `soba.role` with `source = 'feature'` and `feature_code`.
4. In the service or middleware that implements the feature, call `getFeatureByCode(code)` and `isFeatureEnabled(row.status)` before doing the work.
5. In the frontend, once we read flags from `/meta`, gate the UI on the feature code from that response.

## Meta API

All `/api/v1/meta` endpoints are **public** (no JWT). They’re the source of truth for config and reference data so the frontend and tools can bootstrap without hardcoding.

| Endpoint                    | Returns                                                                                            | Query params                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `GET /meta/plugins`         | Discovered plugin catalog — code, enabled flag, whether it has a workspace resolver or feature API | —                                                          |
| `GET /meta/features`        | All feature rows from `soba.feature` with `enabled` boolean                                        | —                                                          |
| `GET /meta/form-engines`    | Installed form engine plugins with `isDefault` flag                                                | —                                                          |
| `GET /meta/build`           | Build metadata — version, `gitSha`, `gitTag`, `imageTag`                                           | —                                                          |
| `GET /meta/frontend-config` | Keycloak config (url, realm, clientId), API base URL, build name/version                           | —                                                          |
| `GET /meta/codes`           | All code tables keyed by name (e.g. `form_status`, `workspace_membership_role`)                    | `code_set`, `source`, `is_active`, `only_enabled_features` |
| `GET /meta/roles`           | All platform roles from `soba.role`                                                                | `code`, `source`, `status`, `only_enabled_features`        |

The `/meta/codes` endpoint supports filtering to a specific code set (e.g. `?code_set=workspace_membership_role`) or multiple sets comma-separated. The `only_enabled_features=true` flag excludes codes and roles that belong to disabled features.

> **TODO — Frontend:** We only fetch `/meta/frontend-config` today (on Keycloak init). We should also load and cache on startup: `/meta/features` (replace `NEXT_PUBLIC_FEATURE_FLAGS`), `/meta/codes`, `/meta/roles`, `/meta/form-engines`. Keep `/api/v1/health` live (no cache) for liveness.

## Form Engine

Form.io CE runs as a sidecar. The frontend never talks to it directly; only the backend does.

### Done

- `formio-v5` plugin is wired in and selected via `FORM_ENGINE_DEFAULT_CODE`

### Not Done

- No Form.io API client yet — the official [docs](https://apidocs.form.io/) target Enterprise; a CE-compatible reference client exists [here](https://github.com/usingtechnology/formio-ce-api)
- Form field conventions not decided (title, tags, etc.) — worth exploring Formio tags as a way to associate forms with a Workspace (tenancy)
- Not yet wired into the outbox pattern

## Outbox Pattern

We can’t atomically write to Postgres and Form.io (Mongo). So we write the intent to our DB first and a worker processes it with retries. We need this for two things: **form version** (after publish, sync schema to Form.io and store `engine_schema_ref`) and **submission** (after create, provision in Form.io and store `engine_submission_ref`).

### Done

- `soba.integration_outbox` table exists with the right shape: topic, aggregate type/id, workspace, payload, status (`pending → processing → done / failed`), attempt count, backoff columns
- `DbOutboxQueueAdapter` and `enqueueOutboxEvent` exist for writing events
- `outboxWorker.ts` exists and polls/claims batches
- `SyncService` shell exists to route events to the right form engine adapter

### Not Done

- Nothing calls `enqueueOutboxEvent` yet — no form or submission write enqueues.
- No Form.io client (see Form Engine), so `SyncService` has nothing to call.
- The full flow (enqueue → worker → sync → write ref back) has never been run.

## Cache

Same adapter pattern as other plugins (`CACHE_DEFAULT_CODE`).

### Done

- `CacheAdapter` interface: `get`, `set`, `delete`, `getOrSet`
- `cache-memory` plugin active by default
- One cache key in use: `membership:{workspaceId}:{userId}` — avoids repeated DB lookups per request, invalidated on membership changes

### Not Done

- No Redis implementation yet — expected production backend
- Only one cache key exists; more will be needed as the app grows

## Message Bus

Same adapter pattern (`MESSAGEBUS_DEFAULT_CODE`).

### Done

- `MessageBusAdapter` interface: `publish`, optional `subscribe`
- `messagebus-memory` plugin active by default

### Not Done

- No Redis or NATS implementation yet (NATS preferred for pub/sub at scale)
- `publish` is not called anywhere in core — in place for when the outbox worker and async flows need to fan out events
- No events or message contracts defined

## API Overview

Backend runs on port 4000. Routes live under `/api/`. Per-route-group middleware:

| Route group                           | Auth                                                  | Rate limit | Notes                                         |
| ------------------------------------- | ----------------------------------------------------- | ---------- | --------------------------------------------- |
| `/api/docs`, `/api/docs/openapi.json` | None                                                  | Public     | Swagger UI and raw OpenAPI JSON spec          |
| `/api/v1/health`                      | None                                                  | Public     | Liveness and readiness                        |
| `/api/v1/meta/*`                      | None                                                  | Public     | See [Meta API](#meta-api)                     |
| `/api/v1/*` (core)                    | `checkJwt` → `resolveActor` → `coreContextMiddleware` | API        | All domain routes; workspace context required |
| `/api/v1/admin/*`                     | `checkJwt` → `resolveActor` → `requireSobaAdmin`      | API        | Platform admin only; no workspace context     |

Core domain routes (all under `/api/v1`, all protected):

| Path                                 | Domain                       |
| ------------------------------------ | ---------------------------- |
| `/workspaces`, `/workspaces/current` | Workspace list and current   |
| `/me`                                | Current actor profile        |
| `/members`                           | Workspace member list        |
| `/forms`, `/form-versions`           | Forms and form versions CRUD |
| `/submissions`                       | Submissions CRUD             |

**OpenAPI / Swagger:** We generate the spec at runtime from Zod with `@asteasolutions/zod-to-openapi`. Each domain registers its routes. Spec at `/api/docs/openapi.json`, UI at `/api/docs`. Both public.

**Health:** Under `/api/v1/health`, `GET /` is liveness (`{ status: 'OK', timestamp }`, no deps). `GET /ready` is readiness: we run `SELECT 1` and call `healthCheck()` on every form engine adapter; 200 when all pass, 503 with per-component detail when something fails.

**CORS:** All origins in dev; blocked in production. No allow-list yet.

### Not Done

- **No versioning strategy** — all routes are under `/api/v1` with no plan yet for how breaking changes would be handled
- **No search/filter completeness** — all list endpoints are cursor-paginated, but filter coverage varies by resource. Additional filters will be needed as the UI matures
- **Plugin feature APIs not mounted** — `pluginApiDefinition` allows plugins to expose their own routes under `/api/v1`, but `createPluginApiRouter()` is not called in `app.ts`; plugin APIs are defined but never registered
- **CORS is all-or-nothing** — no fine-grained origin allow-list for production

## Forms and Submissions

> **Important:** The API below is a technical skeleton; we don’t have locked-down business requirements yet. See [Discussion Points — Forms and submissions](#forms-and-submissions--business-requirements).

### What is wired through to Postgres

All endpoints below are fully connected end-to-end through the service → repo chain to PostgreSQL. Every CRUD operation works at the DB level:

| Resource      | Endpoints                                                                       | Notes                                                                                   |
| ------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Forms         | `GET` (list), `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id`                   | List supports cursor pagination, `q` text filter, `status` filter; delete is soft       |
| Form versions | `GET` (list), `POST`, `GET /:id`, `PATCH /:id`, `POST /:id/save`, `DELETE /:id` | List filters by `formId` and `state`; save appends a revision row                       |
| Submissions   | `GET` (list), `POST`, `GET /:id`, `PATCH /:id`, `POST /:id/save`, `DELETE /:id` | List filters by `formId`, `formVersionId`, `workflowState`; save appends a revision row |

### What is NOT wired — Form.io / Mongo

**Nothing talks to Form.io / Mongo yet.** That’s the biggest gap. The save endpoints accept `enqueueProvision` and the services will call `queueAdapter.enqueue()` when it’s true, but: the outbox worker has no Form.io client to call, no schema or submission payload is ever sent, and `engine_schema_ref` / `engine_submission_ref` stay null. So today you can create forms and submissions in our DB, but they’re empty — no rendered schema, no submission data. Rendering or reading from Form.io will fail until we have a client and the outbox wired through.

### Not Done

- No dedicated publish flow; we can set state to `published` via PATCH but there’s no publish endpoint or rules (e.g. draft-only, one published version per form).
- Submission revisions store metadata/notes, not form field values (those would come from Form.io).
- `enqueueProvision` defaults to true but the outbox does nothing yet — callers may want to pass false until we have a Form.io client.
- No workflow rules for `workflowState`; no transitions or validations.
- No per-form or per-submission access control; any workspace member can read/write/delete everything.

---

# Error Handling

We have a small error hierarchy in `backend/src/core/errors.ts` that maps to HTTP status codes. Use these everywhere; `coreErrorHandler` catches them:

| Class             | Status | Default message           |
| ----------------- | ------ | ------------------------- |
| `ValidationError` | 400    | `'Validation failed'`     |
| `ForbiddenError`  | 403    | `'Forbidden'`             |
| `NotFoundError`   | 404    | `'Not found'`             |
| `ConflictError`   | 409    | `'Conflict'`              |
| `InternalError`   | 500    | `'Internal server error'` |

All five extend `AppError`. Anything else becomes a 500 and gets logged. `AppError` responses are `{ error: string }`. Don’t throw raw `Error` for expected failures — use the subclasses so status and shape stay consistent.

---

# Logging

### Done

- **Pino** in `backend/src/core/logging/logger.ts`. Use `log` — `log.info()`, `log.warn()`, etc. Level from `LOG_LEVEL` (default `debug` in dev, `info` in prod).
- **HTTP:** `pino-http` logs every request (method, URL, status, duration). Level depends on status (4xx → warn, 5xx → error).
- **Request ID:** `cls-rtracer` gives each request a UUID in async local storage. Every log line gets `requestId`; we send it back as `X-Request-Id` and honour an incoming `x-request-id`.
- **Redaction:** `Authorization`, `Cookie`, `set-cookie` are redacted in logs.
- **DB:** Drizzle’s `drizzleQueryLogger` logs SQL at `debug` with the request ID.
- **Dev:** `pino-pretty` for readable, coloured one-liners.

### Not Done

- No log shipping or aggregation (OpenShift, Splunk, etc.) — that’s ops/deployment.
- No frontend logging — we don’t capture or ship client errors.

---

# Rate Limiting

We use three `express-rate-limit` limiters, each tunable by env:

| Limiter           | Default window | Default max | Applied to                            |
| ----------------- | -------------- | ----------- | ------------------------------------- |
| `globalRateLimit` | 60s            | 100         | Every request                         |
| `apiRateLimit`    | 60s            | 60          | Authenticated / mutating API routes   |
| `publicRateLimit` | 60s            | 200         | Public endpoints (health, meta, docs) |

They return standard `RateLimit-*` headers. Limits are in-process only; for multiple replicas we’d need something like Redis.

---

# Testing

### Backend — Jest

Tests live in `backend/tests/` (same shape as `src/`). Right now we have:

- `env`, `pluginConfig`, `workspacePlugins` — config reader and env parsing
- `jwtClaims` — IdP claim mapping and profile helpers
- `validation`, `schema`, `pagination` — shared API middleware and helpers
- `errors`, `errorHandler` — error class and HTTP response mapping
- `cacheKeys`, `events`, `formEngineTopics` — integration utility tests

A few route-level tests use Supertest (e.g. validation, error handler): they spin up a minimal Express app and assert status + shape without the full server.

Rules:

- Test outcomes, not side effects — do not test that a write is made to the error log to indicate a successful test
- Keep mocking to a minimum — a test that is mainly mocks is not very valuable
- Keep supertest tests to basic scenarios (validation, auth rejection, one success path). Deeper flows belong in integration tests

### Frontend — Vitest

Tests live in `frontend/tests/`. What exists today:

- `notificationSlice` — Redux notification state
- `runtimeConfig` — runtime config loading and caching
- `shareForm.url` — URL helpers for form sharing
- `constants` — shared constants

### Integration — Playwright

Lives in `integration/` at the repo root. It runs against a live frontend and backend and uses `data-testid` for selectors — so we need those on interactive elements, landmarks, lists, and status bits.

### API-only integration tests (recommended)

Between unit tests and full Playwright E2E, we should add **API-level integration tests**: sign in once (e.g. call the auth/login or token endpoint with test credentials, or use a test-only token helper), then drive business flows using only HTTP requests to the backend. No browser, no UI — just authenticated API calls through the real stack (DB, services, middleware). This gives faster, more stable coverage of backend behaviour and multi-step flows (e.g. create workspace → create form → create submission) without the cost of E2E. Keep Playwright for a small set of critical user journeys; use API-only integration tests for the bulk of flow coverage.

### Not Done

- No tests yet for repos, services, or domain logic — only infra and helpers.
- No real integration tests beyond the Playwright setup; adding API-only integration tests (see above) would fill the gap before investing in more E2E.
- We should add more backend unit tests for services and repos as we build features.

---

# Frontend

### Done

- Runtime config from backend (`GET /meta/frontend-config`): Keycloak URL, realm, client ID, API base; cached on first load.
- SSO via Keycloak (`idp-bcgov-sso`): login/logout, token in Redux (`keycloak` slice).
- Current user from `GET /me` after auth (`currentUser` slice); Header falls back to id-token claims while loading.
- BC Gov Design System (`@bcgov/design-system-react-components`, tokens, BC Sans).
- i18n with `en`/`fr` and `useDictionary()`.
- Redux with typed hooks (`useAppDispatch`, `useAppSelector`).
- Feature flags (`NEXT_PUBLIC_FEATURE_FLAGS`, `isFeatureEnabled()`) and plugin/home-section registry; workspaces plugin is the reference.

### Not Done

- No nav menu yet — `getNavItem` exists on the plugin interface but the Header doesn’t render links.
- No real landing page; home sections are plugin-driven but empty.
- Feature flags come from env, not the backend — see [Discussion Points — Frontend feature flags](#frontend-feature-flags).
- No role-aware UI (owner, admin, member, viewer).
- No workspace management UI — we can fetch workspaces but there’s no switch/create/manage.
- Form rendering UI is minimal; backend path exists, frontend pages are stubs.
- **No admin UI** — `/api/v1/admin` works (list/add/remove SOBA admins) but there’s no route, page, or nav for it.
- **No feature management UI** — nowhere to view or toggle feature status; that would be a good first admin screen to validate the pattern.

---

# Discussion Points

Things we haven’t decided yet and need input on.

## Roles and codes catalog

We added roles and codes to get the skeleton working. Before we build any real auth or membership logic we need to answer: what roles do we actually need (platform, workspace, form) and what does each allow? Do we keep `admin`, `member`, `viewer` or change them? Do we need more code tables (e.g. submission status)? What’s the full feature set and which roles/codes belong where? We should end up with a committed reference (or extended seed) as the source of truth. **Don’t build enforcement on the current role codes until we have that.**

## Workspace creation gate

Right now any logged-in user gets a personal workspace and owner role on first login. We need a gate: what qualifies someone to create and own a workspace? Could be an IdP role, a SOBA admin grant, an allow-list, or something else. CHEFS only lets IDIR create forms; for us it’s likely a mix of IdP and workspace plugin (e.g. Enterprise decides who owns a tenancy).

## Workspace / tenant context

We don’t yet know how personal or enterprise resolvers will determine which workspace (tenant) a request belongs to. Today personal-local effectively assumes “the user’s one personal workspace” and we don’t have a real “selection” story. Once a user can belong to multiple workspaces we need a contract: how does the client tell the backend which workspace is active? Options to discuss for **personal-local** (and by analogy for enterprise): **cookie** (set on workspace switch, sent automatically; works for same-origin browser, not for API-only or cross-origin), **header** (e.g. `X-Workspace-Id` or `X-Tenant-Id`; explicit, works for API clients and SPAs; client must send it every time), **mint a token** (e.g. short-lived JWT or opaque token that encodes workspace; can be passed in header or cookie; revocable and auditable but we own token lifecycle). Enterprise may get context from a different source (e.g. IdP or gateway). We need to decide and document the contract so frontend and API consumers know what to send.

## Custom IdP plugins vs. Passport

Our IdP layer is custom: each plugin does `createAuthMiddleware` (express-jwt + jwks-rsa) and `createClaimMapper`. It works but overlaps with [Passport.js](https://www.passportjs.org). Passport would give us a big ecosystem (Keycloak, GitHub, Azure AD, etc.) and less code to maintain; staying custom keeps the surface small and we don’t need Passport’s session/serialization for a JWT API — and we’re already doing what its JWT strategy does. Open question: if we add more IdPs (Azure AD, BCeID, BC Services Card), does that justify switching to Passport, or is the thin plugin interface enough? Either way we still need custom claim mapping.

## Two frontends

We’re aiming for two apps: **Manage/Design/Admin** and **Submit**. Do we add a second skeleton now and rename current `/frontend`? Submit should be highly modular — form rendering via an embedded web component so it’s a clear example of what lives in the form vs. the host (see [chefs-embed](https://github.com/usingtechnology/chefs-embed)). We’d support different “flows”: first one like CHEFS (single form → submit), then maybe multi-form flows.

## Integration test layout — backend API-only vs. Manage vs. Submit

We want to add API-only backend integration tests (see [Testing — API-only integration tests](#api-only-integration-tests-recommended)) and will eventually have E2E for both Manage and Submit. **Our integration specialist should drive the decision** on how to lay out and organize these. Open questions: What's the best way to keep **backend API-only** integration tests separate from **frontend Manage** and **frontend Submit** E2E (e.g. directories, configs, CI jobs)? Should API-only tests live under `backend/` (e.g. a dedicated suite and Jest config) or in a top-level folder (e.g. alongside or separate from the current `integration/` Playwright app)? For the two frontends, do we use one E2E suite with Playwright projects and different base URLs, or separate suites per app? Deciding this up front will keep test runs and ownership clear.

## Frontend feature flags

Right now flags come from `NEXT_PUBLIC_FEATURE_FLAGS`. They should come from the backend (`GET /meta/features`) as the single source of truth. Known gap in `DEVELOPER.md` and elsewhere.

## Revision tables — current state vs. history

Today the revision tables are append-only audit: each save inserts a row with `revisionNo`, `eventType`, `changedBy`, `changeNote`, and before/after engine refs; the main row gets a new `currentRevisionNo`. We only store metadata — no schema or submission payload. The before/after refs are both set to the same value (no diff) because we don’t have a Form.io client yet.

**Form.io CE doesn’t do revisions.** We have to own history. Two broad approaches:

- **Store JSON in our revision tables** — put the full schema or submission payload in a `jsonb` column. Postgres holds all history; Form.io only has “current”. Simple and queryable, but big payloads grow the table.
- **One Form.io record per revision** — each revision row points to a different `engine_schema_ref` / `engine_submission_ref`. History is split: metadata in Postgres, content in Form.io/Mongo. Saves storing big JSON here but we get more API calls, orphan cleanup, and Form.io is required to read history.

Then there’s how we use the main vs. revision rows:

- **A — Main = current, revision = history (what we do now).** One query for latest. Revisions are audit only. Point-in-time is hard unless we snapshot content in revisions.
- **B — Revision holds content, main is a pointer.** Every change is an immutable revision with full content; main row just has `currentRevisionNo` (or `latestRevisionId`). Easy “show version N” and undo; reads need a join.
- **C — Both.** Main and revision both have content. Fast reads and full history, but duplication and risk of drift.

We need to decide where the JSON lives and how we structure history before wiring Form.io.

## API access for external clients

Right now only human IdP JWTs can call the API. External systems, scripts, and pipelines can’t. We need to fix that; CHEFS has a lot of API consumers.

**Route shape:** (1) Same `/api/v1` routes, different auth (API key, client credentials, etc.) — one surface to maintain, but response shapes are built for the UI and may not fit integrators; or (2) dedicated routes (e.g. `/api/ext/v1`) with simpler, stable shapes for API clients — clearer boundary and easier to version/rate-limit, but more to maintain and keep in sync; or (3) same routes, middleware that adapts by client type (serializer, filters, rate limits). Single surface but trickier to reason about.

**How do machine clients get credentials?** Options:

- **BC Gov API Gateway (Kong)** — consumers register at the gateway and get a client ID. Gateway does rate limiting, metrics, key lifecycle. We just bind client ID → workspace. Offloads key management; we depend on the gateway team and need a story for local dev.
- **Keycloak client credentials** — register a client in the realm; client gets a JWT via client_id/client_secret. Our existing `checkJwt` can validate it; we’d need a claim mapper so the token carries workspace (or we resolve it from the client id). Standard OAuth2; Keycloak admin per consumer.
- **We issue API keys** — store hashed keys per workspace (with expiry). Middleware validates the key and resolves workspace. No external dependency; we own rotation, revocation, and abuse handling.

We could combine (e.g. gateway in front, Keycloak or our keys behind). The decision is who owns lifecycle and how a credential maps to a workspace.

## Forms and submissions — business requirements

The forms/submissions API is a technical skeleton. We don’t have locked requirements yet for: form lifecycle (draft → published → archived, versioning), submission workflow states and transitions, who can do what beyond workspace membership, or what the submission payload contains and where it lives (Postgres, Form.io, or both).
