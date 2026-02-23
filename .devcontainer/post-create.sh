#!/bin/bash
set -e

echo "══════════════════════════════════════════════════════════════"
echo "  SOBA — Dev Container Setup"
echo "══════════════════════════════════════════════════════════════"
echo ""

# ── Install backend dependencies ────────────────────────────────────────────
echo "==> Installing backend dependencies..."
cd backend
npm ci
cd ..

# ── Install frontend dependencies ─────────────────────────────────────────────
echo "==> Installing frontend dependencies..."
cd frontend
pnpm install
cd ..

# ── Set up environment file ─────────────────────────────────────────────────
if [ -f backend/.env.example ] && [ ! -f backend/.env ]; then
  echo "==> Creating backend/.env from .env.example..."
  cp backend/.env.example backend/.env
  echo "    Review backend/.env and set values for your environment"
else
  echo "==> backend/.env already exists or no .env.example, skipping..."
fi

# ── Set up local overrides file (create once, never overwrite) ──────────────
if [ ! -f backend/.env.local ]; then
  echo "==> Creating backend/.env.local from .env.local.example..."
  cp backend/.env.local.example backend/.env.local
  echo "    Add credentials and overrides to backend/.env.local (never committed)"
else
  echo "==> backend/.env.local already exists, skipping..."
fi

# ── Set up frontend environment file ───────────────────────────────────────
if [ -f frontend/.env.example ] && [ ! -f frontend/.env ]; then
  echo "==> Creating frontend/.env from .env.example..."
  cp frontend/.env.example frontend/.env
  echo "    Values are for localhost; edit frontend/.env for other environments"
else
  echo "==> frontend/.env already exists or no .env.example, skipping..."
fi

# ── Print summary ───────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Setup complete!"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "  Quick start:"
echo "    Backend:  npm run dev --prefix backend   (or use launch config 'SOBA Backend')"
echo "    Frontend: pnpm dev (in frontend/)        (or use launch config 'SOBA Frontend')"
echo "    Both:     use compound 'SOBA (Backend + Frontend)'"
echo ""
echo "  Endpoints:"
echo "    Backend API:  http://localhost:4000"
echo "    Frontend:     http://localhost:3000"
echo ""
echo "  Databases (start sidecars with: docker compose -f .devcontainer/docker-compose.yml up -d):"
echo "    MongoDB:    mongodb://host.docker.internal:27017"
echo "    PostgreSQL: postgresql://postgres:postgres@host.docker.internal:5432/postgres"
echo "    psql:       psql -h host.docker.internal -U postgres -d postgres"
echo "    mongosh:    mongosh 'mongodb://host.docker.internal:27017'"
echo ""
echo "  Installed tools:"
echo "    node $(node --version) | npm $(npm --version) | pnpm $(pnpm --version 2>/dev/null || echo 'n/a')"
echo "    psql (PostgreSQL) $(psql --version 2>/dev/null | awk '{print $3}' || echo 'n/a')"
echo "    mongosh $(mongosh --version 2>/dev/null | head -1 || echo 'n/a')"
echo "    helm $(helm version --short 2>/dev/null || echo 'n/a')"
echo "    kubectl $(kubectl version --client --short 2>/dev/null || kubectl version --client -o json 2>/dev/null | jq -r '.clientVersion.gitVersion' || echo 'n/a')"
echo "    oc $(oc version --client 2>/dev/null | head -1 || echo 'n/a')"
echo "    k6 $(k6 version 2>/dev/null || echo 'n/a')"
echo "    gh $(gh --version 2>/dev/null | head -1 || echo 'n/a')"
echo ""