#!/bin/bash
set -e

echo "══════════════════════════════════════════════════════════════"
echo "  SOBA — Dev Container Setup"
echo "══════════════════════════════════════════════════════════════"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# shellcheck source=scripts/pnpm-setup.sh
source "$SCRIPT_DIR/scripts/pnpm-setup.sh"

echo "==> Configuring pnpm..."
configure_pnpm

# Env files are created and kept in step with their *.example templates by
# post-start.sh (env-sync), plus initializeCommand on the host — nothing here.

install_workspace_deps full

# ── Print summary ───────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Setup complete!"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "  Quick start:"
echo "    Backend:  pnpm dev (in backend/)   (or use launch config 'SOBA Backend')"
echo "    Frontend: pnpm dev (in frontend/)        (or use launch config 'SOBA Frontend')"
echo "    Both:     use compound 'SOBA (Backend + Frontend)'"
echo ""
echo "  Integration (Playwright) e2e: opt-in — see integration/README.md"
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
echo "  Troubleshooting:"
echo "    pnpm clean:workspace && pnpm install"
echo ""
