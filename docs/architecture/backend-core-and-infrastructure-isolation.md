# Backend core and infrastructure isolation

**Audience:** Engineers working in SOBA and technically aware leads (architecture, platform, security).

**Purpose:** Describe why we separate the application core from heavy infrastructure integrations (Temporal, Redis, NATS, etc.), what “optional” means in **development** versus **production images**, and which architectural patterns are viable.

---

## 1. Problem overview

### 1.1 What we are solving

SOBA’s backend must stay **maintainable and auditable** while integrating **large, optional** dependencies:

- **Temporal** — workflow engine, gRPC, worker process, bundled workflow code, native/core components.
- **Redis** — caching, sometimes queues or pub/sub patterns.
- **NATS** — messaging / event distribution.

These stacks:

- Pull in **substantial transitive dependency trees** (and sometimes native tooling).
- Have **operational and security surface** (credentials, ports, upgrades).
- Are **not required for every deployment** (some tenants or environments want a smaller footprint).

If all such libraries are always **direct or transitive dependencies** of the main `backend` package, **every deployable image** carries them, regardless of runtime configuration. Environment variables like `TEMPORAL_ENABLED=false` **do not remove packages from `node_modules`** — they only change behavior at runtime.

### 1.2 What “clean separation” means

| Layer | Responsibility |
|--------|----------------|
| **Core** | Business rules, HTTP API, persistence orchestration, auth. Depends on **abstract ports** (interfaces), not on Temporal/Redis/NATS SDKs. |
| **Ports (contracts)** | Small, stable interfaces: cache, message bus, workflow runtime, etc. No vendor imports. |
| **Adapters (implementations)** | Concrete integrations: `workflow-temporal`, `cache-redis`, `bus-nats`, plus **in-memory** variants for tests and local speed. |

**Dependency rule:** vendor SDKs appear **only** in adapter packages (or plugin packages), not in core source.

### 1.3 Two environments, two rules

| Environment | Goal |
|-------------|------|
| **Devcontainer / local dev** | **Low friction:** install **all** adapters developers might need. **Runtime config** (env) selects in-memory vs Temporal vs NATS for that session. |
| **Deployable container image** | **Minimal footprint:** `node_modules` (and native extras) contain **only** what that deployment’s **install graph** actually depends on. Runtime config must stay consistent with what is installed. |

This document treats **dev richness** and **prod leanness** as compatible: **fat dev graph**, **slim prod graph**, same **ports** and **wiring pattern**.

---

## 2. Viable options (summary)

These are **strategic** choices; tooling (`pnpm` filters, `pnpm deploy`, multi-stage Dockerfiles) can be applied under any of them.

| Option | Short description | Best when |
|--------|-------------------|-----------|
| **A. Contracts package + adapter packages** | `@soba/contracts` holds ports; each vendor (and in-memory) is `@soba/*` with SDK only there; `backend` avoids listing heavy adapters if you use a bundle for prod. | You want the **clearest** boundaries and **strong** “not on image” guarantees. |
| **B. Assembly / server packages** | Tiny `@soba/server-lite`, `@soba/server-full`, etc. **declare** which adapters exist for that image; Docker/CI install from that package’s graph. | You want **one obvious place** per product shape and simple CI (`pnpm install --filter …`). |
| **C. Ports in backend + adapters as workspace packages** | Keep port **types** under `backend/src/core/integrations` (as today for message bus/cache); implementations live in `@soba/bus-nats` etc. | **Incremental** adoption; migrate port types to `contracts` when `adapter → backend` coupling hurts. |
| **D. Plugin directories + optional Compose** | Organize like existing `plugins/`; Compose **profiles** for NATS/Temporal/Redis. | Familiar **discovery** model; **image leanness** still needs **per-plugin packages** or disciplined copy/prune. |
| **E. Transitional monolith (optional peers)** | Single `backend` with `optionalDependencies` / peers; minimal images via special install/prune. | **Short-term** only; easy to misconfigure; weak guarantee vs A/B. |

**Recommended long-term combination:** **A + B** (contracts + adapters + `server-*` bundles). **C** is a reasonable **first step** toward A.

---

## 3. Option A — Contracts package + adapter packages

### 3.1 Idea

- **`@soba/contracts`:** interfaces and shared DTOs for `Cache`, `MessageBus`, `WorkflowRuntime`, and small **injected** types (e.g. a minimal logger facade). **No** Express, Drizzle, Temporal, Redis, NATS.
- **`@soba/workflow-temporal`:** `@temporalio/*` + Temporal worker entry (or sibling worker package). Implements `WorkflowRuntime` from contracts.
- **`@soba/cache-redis`:** `ioredis` (or `redis`) only here. Implements `Cache` port.
- **`@soba/bus-nats`:** `nats` client only here. Implements `MessageBus` port.
- **`@soba/*-memory`:** in-memory implementations; depend **only** on `contracts`.

**Dependency direction:**

```text
@soba/contracts
       ↑
       ├── @soba/backend (core: uses ports, no vendor SDKs)
       ├── @soba/workflow-temporal
       ├── @soba/cache-redis
       ├── @soba/bus-nats
       └── @soba/*-memory
```

Adapters must **not** import `backend` for types; that inverts the graph and drags the monolith into every adapter.

### 3.2 Devcontainer

Install the **full workspace** so every adapter is linked. Env vars (e.g. `WORKFLOW_PROVIDER=memory|temporal`) select behavior. No need for slim `node_modules` locally.

### 3.3 Production image

`@soba/backend` **alone** should not need to list every adapter. A **bundle** (see Option B) or profile-specific manifest lists e.g. `backend + contracts + workflow-temporal + bus-nats` for one image, and `backend + contracts + cache-memory + bus-memory` for another — **Temporal never enters the install graph** for the latter.

### 3.4 Tradeoffs

- **Pros:** Strong separation; clear audits; optional images are real optional **bytes**.
- **Cons:** More packages and versioning; need discipline for factories and worker images.

---

## 4. Option B — Assembly / `server-*` packages

### 4.1 Idea

Add small packages whose **only** job is to define **which code ships together**:

- **`@soba/server-dev`** (optional): depends on `backend`, `contracts`, and **all** adapters — used for local parity or specialized dev images.
- **`@soba/server-lite`:** e.g. `backend + contracts + cache-memory + bus-memory` only.
- **`@soba/server-full`:** adds `workflow-temporal`, `cache-redis`, `bus-nats`, etc.

Each package exposes **`main`** (or imports bootstrap from `backend`) that:

1. Loads only factories available for that graph.
2. Builds `createApp(...)` / context with injected ports.

### 4.2 Devcontainer

Default to **fat** graph (`server-dev` or root workspace install). Same runtime env switching as today.

### 4.3 Production image

Dockerfile runs `pnpm install --frozen-lockfile --filter @soba/server-lite...` (or `pnpm deploy` for that package). CI promotes **image flavor** = **server package**.

### 4.4 Tradeoffs

- **Pros:** Single declarative list per product shape; easy onboarding (“this OpenShift env uses `server-full`”).
- **Cons:** Extra packages; must keep **env/config docs** aligned with **which server package** is deployed.

---

## 5. Option C — Ports in `backend`, adapters as workspace packages

### 5.1 Idea

Keep port interfaces where many already live: `backend/src/core/integrations` (`MessageBusAdapter`, `CacheAdapter`, `QueueAdapter`, etc.). Move **vendor** code to `@soba/bus-nats`, `@soba/cache-redis`, `@soba/workflow-temporal`.

Initial state may have **adapters importing `PluginConfigReader`** from `backend` — that creates **`implementation → backend`** coupling. Long term, **lift port + factory types** into `@soba/contracts` (or a thin shared module) so adapters depend only on contracts.

### 5.2 Devcontainer

Unchanged: full workspace + env switching.

### 5.3 Production image

Same as A/B: **backend** `package.json` for minimal prod should **not** list Temporal; a bundle or `server-lite` adds only required adapters.

### 5.4 Tradeoffs

- **Pros:** Smallest conceptual leap from current layout; reuse existing naming and patterns.
- **Cons:** Risk of lingering imports from adapters into `backend`; needs a clear migration to contracts for a pure graph.

---

## 6. Option D — Plugin directories + Compose profiles

### 6.1 Idea

Mirror **filesystem** organization (e.g. `src/plugins/messagebus-nats/`) and **Docker Compose profiles** for optional brokers (NATS, Temporal, Redis) in dev.

### 6.2 Devcontainer

`docker compose --profile temporal --profile nats up` vs base profile. Application still selects implementation via env.

### 6.3 Production image

**Folders alone do not remove npm deps.** For a strict guarantee, each heavy plugin should still be a **separate package** with its own `dependencies`, or the image build must **exclude** unused plugin packages from the install graph. Otherwise sources may exist without being used — but if `backend` still depends on `@temporalio/*`, the image is still fat.

### 6.4 Tradeoffs

- **Pros:** Discoverable layout; matches Form.io-style plugins; good DX for “turn on the broker.”
- **Cons:** Weakest **automatic** lean-image story unless combined with **per-integration packages** (A).

---

## 7. Option E — Transitional monolith (optional peers)

### 7.1 Idea

Keep a single `@soba/backend` and mark Redis/NATS/Temporal as **`optionalDependencies`** or **`peerDependencies`**, with runtime guards.

### 7.2 Devcontainer

Single install; optional packages may or may not install depending on lockfile and platform.

### 7.3 Production image

Requires **`pnpm install --prod`**, omit optional failures, or alternate lockfiles — **easy to get wrong**. Unused packages may still appear if declared.

### 7.4 Tradeoffs

- **Pros:** Fast to try.
- **Cons:** **Weak** guarantee on image contents; security and compliance reviews prefer explicit graphs (A/B).

---

## 8. Cross-cutting concerns

### 8.1 Runtime config vs install graph

- **Environment variables** choose **which adapter instance** runs among **what is installed**.
- They **do not** remove unused packages. **Slim images** require **slim `package.json` graphs** (bundle / filter / deploy).

### 8.2 Fail fast in production

If an image lacks Temporal but config says `WORKFLOW_PROVIDER=temporal`, **startup should error** with a clear message (and optionally compare against a **build-time capability list**).

### 8.3 Dependency injection

A **resolver / bootstrap** module (or `server-*` package) should:

1. Import or dynamically load **only** adapters present in that build.
2. Construct adapters with **injected** dependencies: logger (via a small interface in `contracts`), config DTOs, metrics hooks, etc.

Adapters should **avoid** importing `backend`’s global `log` singleton to keep packages reusable and testable.

### 8.4 Temporal worker process

Temporal is **asymmetric:** API process and **worker** process may share adapter code but need **different entrypoints**. Worker images (or same image, different `CMD`) should include **`workflow-temporal`** only when workflows are a supported capability.

### 8.5 Lockfile and workspaces

All adapters can live in the **same monorepo and lockfile** for simplicity; **production** uses **`--filter`** / **`pnpm deploy`** to install a **subset**. Alternative: **separate lockfiles per profile** — fewer graph surprises at the cost of more CI maintenance.

---

## 9. Suggested direction for SOBA

1. **Near term:** **Option C** — introduce **`@soba/contracts`** for **new** cross-cutting ports (workflows) while keeping existing `integrations` interfaces; add **`@soba/workflow-temporal`** and move Temporal SDK out of `backend` when feasible.
2. **Steady state:** **Options A + B** — ports in `contracts`; **`@soba/server-lite` / `@soba/server-full`** (names TBD) define image shapes; devcontainer uses full workspace.
3. **Avoid** relying on **Option E** for production baselines.

---

## 10. Related documentation

- [Temporal local setup](../temporal.md) and [OpenShift notes](../temporal-openshift.md) — current Temporal operational docs.
- [Build images](../build-images.md) — existing image/build context (update when `server-*` packages exist).

---

## Document history

- Introduced to align developers and senior staff on **core vs infrastructure** split and **fat dev / slim prod** expectations.
