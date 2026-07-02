#!/bin/bash
# Shared pnpm configuration and workspace install for devcontainer lifecycle hooks.
set -euo pipefail

PNPM_STORE_DIR="${PNPM_STORE_DIR:-/home/node/.local/share/pnpm/store}"
DEPS_MARKER=".devcontainer/.deps-installed"

configure_pnpm() {
  export CI=true
  export PNPM_STORE_DIR
  # Env-based config avoids pnpm --global PATH check in non-interactive postCreate shells.
  export npm_config_package_import_method=copy
  mkdir -p "$PNPM_STORE_DIR"
}

clean_workspace_deps() {
  bash "$REPO_ROOT/scripts/clean-workspace.sh" --deps-only -y
}

mark_deps_installed() {
  mkdir -p "$(dirname "$REPO_ROOT/$DEPS_MARKER")"
  touch "$REPO_ROOT/$DEPS_MARKER"
}

deps_need_install() {
  if [[ ! -f "$REPO_ROOT/$DEPS_MARKER" ]]; then
    return 0
  fi
  if [[ "$REPO_ROOT/pnpm-lock.yaml" -nt "$REPO_ROOT/$DEPS_MARKER" ]]; then
    return 0
  fi
  if [[ ! -d "$REPO_ROOT/node_modules/.pnpm" ]]; then
    return 0
  fi
  return 1
}

run_pnpm_install() {
  echo "==> Installing workspace dependencies..."
  pnpm install
  mark_deps_installed
}

install_workspace_deps() {
  local mode="${1:-ensure}"

  case "$mode" in
    full)
      clean_workspace_deps
      run_pnpm_install
      ;;
    ensure)
      if deps_need_install; then
        run_pnpm_install || {
          echo "==> pnpm install failed; cleaning deps and retrying once..."
          clean_workspace_deps
          run_pnpm_install
        }
      else
        echo "==> Workspace dependencies up to date, skipping install."
      fi
      ;;
    *)
      echo "Unknown install mode: $mode" >&2
      exit 1
      ;;
  esac
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi
