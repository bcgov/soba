#!/bin/bash
set -e

echo "══════════════════════════════════════════════════════════════"
echo "  SOBA — Dev Container Post-Start"
echo "══════════════════════════════════════════════════════════════"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Refresh backend/.env from .env.example on each devcontainer start
if [ -f backend/.env.example ]; then
  cp backend/.env.example backend/.env
  echo "  Refreshed backend/.env from .env.example"
fi

# Refresh frontend/.env from .env.example on each devcontainer start
if [ -f frontend/.env.example ]; then
  cp frontend/.env.example frontend/.env
  echo "  Refreshed frontend/.env from .env.example"
fi

echo "══════════════════════════════════════════════════════════════"