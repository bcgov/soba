# SOBA Dev Container

This directory contains the configuration for the SOBA development container and sidecar services.

## Build Process

### 1. Initialize (before container starts)

Runs on the host before the container is built or started:

- **Environment files**: Copies example files to active env files only if targets don't exist (`cp -n`):
  - `backend/.env.example` → `backend/.env`, `backend/.env.local.example` → `backend/.env.local`
  - `frontend/.env.example` → `frontend/.env`
  - Existing files (e.g. `backend/.env.local` with secrets) are never overwritten.

### 2. Container build

The `Dockerfile` builds a Node.js 24 image with:

- **Package managers**: npm, pnpm (via corepack)
- **Database clients**: PostgreSQL 17 client, `mongosh` (MongoDB shell)
- **CLI tools**: `jq`, `curl`, `k6` (load testing), `oc` (OpenShift CLI)
- **Features**: Docker-in-Docker, GitHub CLI, kubectl, Helm

### 3. Container start

- **Host access**: `runArgs` includes `--add-host=host.docker.internal:host-gateway` so that `host.docker.internal` resolves to the host from inside the container (needed on Linux; Docker Desktop on Mac/Windows provides it by default). Memory and Node heap limits are **not** set in `devcontainer.json`; see [Memory and Node performance](#memory-and-node-performance-per-developer). Backend and frontend processes still read their own `.env` files via **dotenv** / Next.js; those files are **not** injected into the container via Docker `--env-file`.
- **Forwarded ports**: 3000 (Frontend), 3001 (Form.io), 4000 (Backend)

### 4. Post-create (first run only)

Runs once when the devcontainer is first created:

- Installs backend dependencies (`npm ci` in `backend/`)
- Installs frontend dependencies (`pnpm install` in `frontend/`)
- Creates `backend/.env`, `backend/.env.local`, and `frontend/.env` from examples if missing (safety net)

### 5. Post-start (every container start)

- Refreshes `backend/.env` and `frontend/.env` from their `.env.example` files on each start.
- `backend/.env.local` is never touched and keeps your secrets.

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

- **SOBA (Backend + Outbox + Temporal)**: backend stack only — then run `soba-fe` in a terminal for frontend (`http://localhost:3000`)
- **SOBA (Backend + Outbox + Temporal + Frontend)**: everything including frontend via `pnpm dev:watch`
- **SOBA Backend** / **SOBA Frontend**: individual services (`http://localhost:4000`, `http://localhost:3000`)

### Option 2: Terminal

```bash
# Backend
pnpm --dir backend dev

# Frontend (in another terminal) — prefer soba-fe after setting up ~/.bashrc
soba-fe
# or: cd frontend && pnpm dev
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

## Memory and Node performance (per developer)

The devcontainer does **not** set Docker memory caps or `NODE_OPTIONS` in `devcontainer.json`. Each developer tunes heap and tooling for their machine.

### Why this matters

Node's `--max-old-space-size` caps the V8 heap **per process**. Next.js dev, Jest, and the TypeScript language server (`tsserver`) each run as separate processes. If total usage exceeds available RAM, Linux may **SIGKILL** a process (tests or dev server die with no stack trace).

Some `package.json` scripts still set `NODE_OPTIONS` inline (e.g. `frontend` `dev`, `backend` `test`). Those **override** your shell defaults for that command. Use the aliases below to bypass them when you want personal limits.

### Option 1: Container `~/.bashrc` (task-specific aliases)

`~/.bashrc` is **inside the container** (typically `/home/node/.bashrc`), not your host home directory. It is **not** in git. It usually survives container stop/start but is **lost on rebuild** — re-copy after rebuild.

```bash
cp .devcontainer/bashrc.example ~/.bashrc
source ~/.bashrc
```

Verify:

```bash
echo $NODE_OPTIONS
type soba-fe
```

**Practical examples** (also in `.devcontainer/bashrc.example`):

```bash
# Default heap for generic node commands in this shell
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

# Frontend hot reload — bypasses frontend/package.json dev script heap
soba-fe() {
  NODE_OPTIONS=--max-old-space-size=1536 pnpm --dir /workspaces/soba/frontend exec next dev --hostname 0.0.0.0
}

# Backend tests — serial, low memory
soba-test-be() {
  NODE_OPTIONS=--max-old-space-size=1024 pnpm --dir /workspaces/soba/backend exec jest --runInBand
}
```

**Larger machine (16 GB+ host, comfortable Docker limits):**

```bash
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

soba-fe() {
  NODE_OPTIONS=--max-old-space-size=3072 pnpm --dir /workspaces/soba/frontend exec next dev --hostname 0.0.0.0
}

soba-test-be() {
  NODE_OPTIONS=--max-old-space-size=1536 pnpm --dir /workspaces/soba/backend exec jest --maxWorkers=2
}
```

Use `soba-fe` instead of `pnpm dev` in `frontend/` when you want your heap, not the script default.

### Option 2: Cursor User settings (survives container rebuild)

Open **User** settings JSON (not workspace `.vscode/settings.json`). These apply to integrated terminals in the devcontainer and persist on your host.

**Conservative (laptop / tight memory):**

```json
{
  "terminal.integrated.env.linux": {
    "NODE_OPTIONS": "--max-old-space-size=1536"
  },
  "typescript.tsserver.maxTsServerMemory": 1536
}
```

**Comfortable (16 GB+ host):**

```json
{
  "terminal.integrated.env.linux": {
    "NODE_OPTIONS": "--max-old-space-size=4096"
  },
  "typescript.tsserver.maxTsServerMemory": 3072
}
```

Open a **new** terminal and run `echo $NODE_OPTIONS` to confirm.

`typescript.tsserver.maxTsServerMemory` frees RAM for Next/Jest by capping the IDE TypeScript server.

### Option 3: One-off CLI

```bash
NODE_OPTIONS=--max-old-space-size=1536 pnpm --dir frontend exec next dev --hostname 0.0.0.0
NODE_OPTIONS=--max-old-space-size=1024 pnpm --dir backend exec jest --runInBand
```

### What is not covered by personal env

| Mechanism                            | Terminals                       | F5 Run and Debug                       |
| ------------------------------------ | ------------------------------- | -------------------------------------- |
| `~/.bashrc` / aliases                | Yes                             | No (unless launch runs via your shell) |
| User `terminal.integrated.env.linux` | Yes                             | Usually no                             |
| `package.json` script prefix         | Overrides shell for that script | Yes, if launch uses the script         |

For stable frontend dev on smaller machines, use **SOBA (Backend + Outbox + Temporal)** from Run and Debug, then **`soba-fe`** in a terminal — instead of the all-in-one compound that starts frontend via `dev:watch`.

### Troubleshooting

| Symptom                          | Likely cause            | Action                                                                           |
| -------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `JavaScript heap out of memory`  | V8 heap too small       | Raise `max-old-space-size` for that task                                         |
| Jest/test suite `signal=SIGKILL` | Total RAM exceeded      | Lower heaps, use `soba-test-be`, avoid running `pnpm qa` while Next is compiling |
| Slow but stable                  | Low heap / serial tests | Expected; use `test:parallel` or higher heaps on a bigger machine                |

### Quick checklist for new developers

1. Copy `.devcontainer/bashrc.example` → `~/.bashrc` and `source ~/.bashrc`
2. Set User `terminal.integrated.env.linux` and `typescript.tsserver.maxTsServerMemory`
3. Start frontend with `soba-fe`; run tests with `soba-test-be` or `pnpm test:backend`
4. After **Rebuild Container**, repeat step 1 (User settings from step 2 remain)

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
| **Post-start** (every start)             | `cp .env.example .env` — refreshes `backend/.env` and `frontend/.env` from their examples. `backend/.env.local` is never touched. |

### How they are applied

| Context              | Mechanism                                                                    |
| -------------------- | ---------------------------------------------------------------------------- |
| **Devcontainer**     | Does not load `backend/.env` or `backend/.env.local` into the container env. |
| **Backend process**  | `dotenv.config('.env')` then `dotenv.config('.env.local', override: true)`.  |
| **Frontend process** | Next.js loads `frontend/.env` automatically at build and runtime.            |

### Summary

- `.env` is never committed; it is created from `.env.example` when the devcontainer starts.
- Backend: put credentials in `.env.local`; it is never overwritten.
- Frontend: `.env.example` values target localhost; edit `.env` for other environments.
