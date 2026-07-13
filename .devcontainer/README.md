# SOBA Dev Container

This directory contains the configuration for the SOBA development container and sidecar services.

## Build Process

### 1. Initialize (before container starts)

Runs on the host before the container is built or started:

- **Environment files**: Copies example files to active env files only if targets don't exist (`cp -n`):
  - `backend/.env.example` → `backend/.env`, `backend/.env.local.example` → `backend/.env.local`
  - `frontend/.env.example` → `frontend/.env`
  - Existing files (e.g. `backend/.env.local` with secrets) are not overwritten by this step.

### 2. Container build

The `Dockerfile` builds a Node.js 24 image with:

- **Package managers**: npm, pnpm@10.28.2 (via corepack)
- **pnpm store**: `/home/node/.local/share/pnpm/store` on container disk (not the virtiofs workspace mount)
- **Database clients**: PostgreSQL 17 client, `mongosh` (MongoDB shell)
- **CLI tools**: `jq`, `curl`, `k6` (load testing), `oc` (OpenShift CLI)
- **Features**: Docker-in-Docker, GitHub CLI, kubectl, Helm

### 3. Container start

- **Host access**: `runArgs` includes `--add-host=host.docker.internal:host-gateway` so that `host.docker.internal` resolves to the host from inside the container (needed on Linux; Docker Desktop on Mac/Windows provides it by default). Node heap size comes from the host `DEVCONTAINER_NODE_OPTIONS` variable via `containerEnv` (empty by default), and a `hostRequirements.memory` hint of 4 GB is declared; see [Memory and Node performance](#memory-and-node-performance). Backend and frontend processes still read their own `.env` files via **dotenv** / Next.js; those files are **not** injected into the container via Docker `--env-file`.
- **Forwarded ports**: 3000 (Frontend), 3001 (Form.io), 4000 (Backend)

### 4. Post-create (first run only)

Runs once when the devcontainer is first created:

- Configures pnpm (copy import method, store off virtiofs) for reliable installs on all architectures
- Creates `backend/.env`, `backend/.env.local`, and `frontend/.env` from examples if missing (safety net)
- Cleans dependency trees, then runs `pnpm install` at the repo root (workspace: frontend + backend)
- Integration (Playwright) tests are opt-in and **not** installed here — see `integration/README.md`

### 5. Post-start (every container start)

- Syncs `backend/.env`, `backend/.env.local`, and `frontend/.env` with their `*.example` templates: creates them if missing, and when a template changes, backs up the current file to `*.prev` before applying the new template. Change is detected via a gitignored `*.hash` marker, so it survives git checkouts (which reset mtimes).
- After a template change to `.env.local`, re-apply your secrets from the backup — the new template ships with placeholders.
- Runs `pnpm install` only when `pnpm-lock.yaml` changed or dependencies are missing (not on every start).

---

## What's Available After Build

| Tool              | Location               | Purpose                    |
| ----------------- | ---------------------- | -------------------------- |
| Node.js           | 24.x                   | Runtime                    |
| npm               | 10.x                   | Backend package manager    |
| pnpm              | 10.x                   | Frontend package manager   |
| PostgreSQL client | `psql`                 | Connect to Postgres        |
| MongoDB shell     | `mongosh`              | Connect to MongoDB         |
| k6                | `/usr/local/bin/k6`    | Load testing               |
| oc                | `/usr/local/bin/oc`    | OpenShift CLI              |
| Docker            | (via Docker-in-Docker) | Run sidecars, build images |

**VS Code extensions**: ESLint, Prettier, Docker, PostgreSQL, Kubernetes Tools

---

## Starting Services

### Sidecar services (databases, Form.io)

Start MongoDB, PostgreSQL, and Form.io from inside the devcontainer:

```bash
docker compose -f .devcontainer/docker-compose.yml up -d
```

Stop services:

```bash
docker compose -f .devcontainer/docker-compose.yml down
```

### Database (migrate + seed)

After the sidecar services are running, from the **repo root** run:

```bash
pnpm db:init
```

This runs pending PostgreSQL migrations and seeds the database. You can also run `pnpm db:migrate` and `pnpm db:seed` separately.

### Connection strings (from inside devcontainer)

Use `host.docker.internal` to reach the sidecar services (the devcontainer is started with `host.docker.internal:host-gateway` so this works on Linux and Docker Desktop):

| Service    | Connection                                                          |
| ---------- | ------------------------------------------------------------------- |
| MongoDB    | `mongodb://host.docker.internal:27017`                              |
| PostgreSQL | `postgresql://postgres:postgres@host.docker.internal:5432/postgres` |
| Form.io    | `http://host.docker.internal:3001`                                  |

**Form.io login**: `formio@localhost.com` / `formio`

---

## Starting the App

### Option 1: VS Code launch

- **SOBA (Backend + Temporal)**: backend stack only — then run `pnpm --dir frontend dev` (or `soba-fe`) in a terminal for the frontend (`http://localhost:3000`)
- **SOBA (Backend + Temporal + Frontend)**: everything including frontend via `pnpm dev:watch`
- **SOBA Backend** / **SOBA Frontend**: individual services (`http://localhost:4000`, `http://localhost:3000`)

### Option 2: Terminal

```bash
# Backend
pnpm --dir backend dev

# Frontend (in another terminal) — or `soba-fe` with the bashrc aliases
pnpm --dir frontend dev
```

### Endpoints

Open these in a browser on your **host** (ports are forwarded from the container):

| App         | URL                   |
| ----------- | --------------------- |
| Frontend    | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Form.io     | http://localhost:3001 |

The frontend example uses `NEXT_PUBLIC_SOBA_API_BASE_URL=http://localhost:4000/api/v1`, so the app works when you use it from the host at http://localhost:3000 (API calls go to the forwarded backend).

---

## Memory and Node performance

The devcontainer sets the container-wide `NODE_OPTIONS` from the host `DEVCONTAINER_NODE_OPTIONS` variable (empty by default, so no heap cap) and declares a `hostRequirements.memory` hint of 4 GB. Because it is set in `containerEnv`, the value applies to **every** process in the container — integrated terminals **and** F5 Run-and-Debug — with no per-shell setup.

If local builds run out of memory, first increase the memory available to your Docker runtime (Docker Desktop, Rancher Desktop, Colima, OrbStack, or your equivalent container manager). For Node heap-related failures, launch the editor with a heap cap:

```bash
DEVCONTAINER_NODE_OPTIONS="--max-old-space-size=4096" code .
```

### Why this matters

Node's `--max-old-space-size` caps the V8 heap **per process**. Next.js dev, Jest, and the TypeScript language server (`tsserver`) each run as separate processes. If total usage exceeds available RAM, Linux may **SIGKILL** a process (tests or dev server die with no stack trace).

Some `package.json` scripts set `NODE_OPTIONS` inline (e.g. `frontend` `dev`, `backend` `test`). An inline value **overrides** the container-wide `DEVCONTAINER_NODE_OPTIONS` for that command. Use the one-off CLI form below to run one of those with a different heap.

### Per-task overrides

**Container `~/.bashrc` aliases** — task-specific aliases inside the container (`/home/node/.bashrc`, not your host home; not in git; lost on rebuild — re-copy after):

```bash
cp .devcontainer/bashrc.example ~/.bashrc
source ~/.bashrc
```

This adds `soba-fe` (frontend dev with its own heap), `soba-test-be` (serial backend tests), and a default shell `NODE_OPTIONS`. See `.devcontainer/bashrc.example` for the values and larger-machine variants.

**One-off CLI** — a specific heap for a single command, bypassing the script default:

```bash
NODE_OPTIONS=--max-old-space-size=1536 pnpm --dir frontend exec next dev --hostname 0.0.0.0
NODE_OPTIONS=--max-old-space-size=1024 pnpm --dir backend exec jest --runInBand
```

**VS Code User settings** — a persistent terminal default on your host (survives container rebuild). Open **User** settings JSON (not workspace `.vscode/settings.json`):

Conservative (laptop / tight memory):

```json
{
  "terminal.integrated.env.linux": {
    "NODE_OPTIONS": "--max-old-space-size=1536"
  },
  "typescript.tsserver.maxTsServerMemory": 1536
}
```

Comfortable (16 GB+ host):

```json
{
  "terminal.integrated.env.linux": {
    "NODE_OPTIONS": "--max-old-space-size=4096"
  },
  "typescript.tsserver.maxTsServerMemory": 3072
}
```

Open a **new** terminal and run `echo $NODE_OPTIONS` to confirm. `typescript.tsserver.maxTsServerMemory` caps the IDE TypeScript server, freeing RAM for Next/Jest.

### What sets NODE_OPTIONS where

| Mechanism                                        | Terminals                           | F5 Run and Debug               |
| ------------------------------------------------ | ----------------------------------- | ------------------------------ |
| `DEVCONTAINER_NODE_OPTIONS` (via `containerEnv`) | Yes                                 | Yes                            |
| `~/.bashrc` / aliases                            | Yes                                 | No (unless launch runs via your shell) |
| User `terminal.integrated.env.linux`             | Yes                                 | Usually no                     |
| `package.json` script prefix                     | Overrides the above for that script | Yes, if launch uses the script |

For stable frontend dev on smaller machines, launch with a modest `DEVCONTAINER_NODE_OPTIONS`, run **SOBA (Backend + Temporal)** from Run and Debug, then start the frontend in a terminal (`pnpm --dir frontend dev`, or `soba-fe` with the bashrc aliases) — instead of the all-in-one compound that starts the frontend via `dev:watch`.

### Troubleshooting

| Symptom                          | Likely cause            | Action                                                                           |
| -------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `JavaScript heap out of memory`  | V8 heap too small       | Raise `max-old-space-size` (relaunch with a larger `DEVCONTAINER_NODE_OPTIONS`, or use the one-off CLI) |
| `pnpm install` fails with `EINVAL` on virtiofs | Corrupt/partial `node_modules` on VM mount | Run `pnpm clean:workspace && pnpm install`, then rebuild container |
| Jest/test suite `signal=SIGKILL` | Total RAM exceeded      | Lower heaps, run `pnpm --dir backend test` or `soba-test-be` (serial), avoid `pnpm qa` while Next is compiling |
| Slow but stable                  | Low heap / serial tests | Expected; use `test:parallel` or a larger heap on a bigger machine               |

### Quick checklist for new developers

1. (Optional) Increase your Docker runtime's memory allocation.
2. Launch with a heap cap if you hit OOM: `DEVCONTAINER_NODE_OPTIONS="--max-old-space-size=4096" code .`
3. (Optional) Copy `.devcontainer/bashrc.example` → `~/.bashrc` and `source ~/.bashrc` for the `soba-fe`/`soba-test-be` aliases (re-copy after a container rebuild).
4. (Optional) Set User `terminal.integrated.env.linux` and `typescript.tsserver.maxTsServerMemory` for a persistent terminal default.
5. Start the frontend with `pnpm --dir frontend dev` (or `soba-fe`); run backend tests with `pnpm --dir backend test` (or `soba-test-be`).

---

## Environment Files

### Backend

The backend uses `.env` and `.env.local`. Values are loaded in order: `.env` first, then `.env.local` (which overrides matching keys). The backend applies them at runtime via `dotenv` only (the devcontainer does not pass them through Docker `runArgs`).

| File                         | Purpose                                                      | Committed |
| ---------------------------- | ------------------------------------------------------------ | --------- |
| `backend/.env.example`       | Base config (Form.io URL, JWT issuer/audience, role mapping) | Yes       |
| `backend/.env.local.example` | Template for credentials (Form.io admin, session secret)     | Yes       |
| `backend/.env`               | Active base config                                           | No        |
| `backend/.env.local`         | Active credentials and secrets                               | No        |

### Frontend

The frontend uses `.env`. Next.js loads it at build/runtime. The example sets `NEXT_PUBLIC_SOBA_API_BASE_URL=http://localhost:4000/api/v1` so the app works when opened from a browser on the host at http://localhost:3000.

| File                    | Purpose                               | Committed |
| ----------------------- | ------------------------------------- | --------- |
| `frontend/.env.example` | Template for localhost / local dev    | Yes       |
| `frontend/.env`         | Active config (Form.io URL, Keycloak) | No        |

### How they are created

| When                                     | Action                                                                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Initialize** (before container starts) | `cp -n` for backend and frontend env files — copies only if the target does not exist. Existing files are never overwritten.      |
| **Post-create** (first run only)         | Same as above, as a safety net.                                                                                                   |
| **Post-start** (every start)             | Syncs `backend/.env`, `backend/.env.local`, and `frontend/.env` with their templates — creates if missing; on a template change, backs up the current file to `*.prev` then applies the new template. |

### How they are applied

| Context              | Mechanism                                                                    |
| -------------------- | ---------------------------------------------------------------------------- |
| **Devcontainer**     | Does not load `backend/.env` or `backend/.env.local` into the container env. |
| **Backend process**  | `dotenv.config('.env')` then `dotenv.config('.env.local', override: true)`.  |
| **Frontend process** | Next.js loads `frontend/.env` automatically at build and runtime.            |

### Summary

- `.env` is never committed; it is created from `.env.example` when the devcontainer starts.
- Backend: put credentials in `.env.local`. It changes only when `.env.local.example` changes, and the previous copy is backed up to `.env.local.prev` so you can re-apply your secrets.
- Frontend: `.env.example` values target localhost; edit `.env` for other environments.
