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

- **Environment**: `runArgs` loads `backend/.env` and `backend/.env.local` into the container environment.
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

### Connection strings (from inside devcontainer)

| Service    | Connection                                                          |
| ---------- | ------------------------------------------------------------------- |
| MongoDB    | `mongodb://host.docker.internal:27017`                              |
| PostgreSQL | `postgresql://postgres:postgres@host.docker.internal:5432/postgres` |
| Form.io    | `http://host.docker.internal:3001`                                  |

**Form.io login**: `formio@localhost.com` / `formio`

---

## Starting the App

### Option 1: VS Code launch (recommended)

- **SOBA Backend**: `http://localhost:4000`
- **SOBA Frontend**: `http://localhost:3000`
- **SOBA (Backend + Frontend)**: Starts both

### Option 2: Terminal

```bash
# Backend
npm run dev --prefix backend

# Frontend (in another terminal)
cd frontend && pnpm dev
```

### Endpoints

| App         | URL                   |
| ----------- | --------------------- |
| Frontend    | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Form.io     | http://localhost:3001 |

---

## Environment Files

### Backend

The backend uses `.env` and `.env.local`. Values are loaded in order: `.env` first, then `.env.local` (which overrides matching keys). The backend applies them at runtime via `dotenv`; the devcontainer also injects them into the container environment via `runArgs`.

| File                         | Purpose                                                          | Committed |
| ---------------------------- | ---------------------------------------------------------------- | --------- |
| `backend/.env.example`       | Base config (Form.io URL, JWT issuer/audience, role mapping)     | Yes       |
| `backend/.env.local.example` | Template for credentials (Form.io admin/manager, session secret) | Yes       |
| `backend/.env`               | Active base config                                               | No        |
| `backend/.env.local`         | Active credentials and secrets                                   | No        |

### Frontend

The frontend uses `.env`. Next.js loads it at build/runtime. Values in `.env.example` are for the localhost environment (local Form.io, BC Gov dev Keycloak).

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

| Context              | Mechanism                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **Devcontainer**     | `runArgs` passes `--env-file backend/.env` and `--env-file backend/.env.local` to Docker. |
| **Backend process**  | `dotenv.config('.env')` then `dotenv.config('.env.local', override: true)`.               |
| **Frontend process** | Next.js loads `frontend/.env` automatically at build and runtime.                         |

### Summary

- `.env` is never committed; it is created from `.env.example` when the devcontainer starts.
- Backend: put credentials in `.env.local`; it is never overwritten.
- Frontend: `.env.example` values target localhost; edit `.env` for other environments.
