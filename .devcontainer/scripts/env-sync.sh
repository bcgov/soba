#!/bin/bash
# Keep active env files in step with their committed *.example templates.
# Creates a file when missing; when its template changes, backs up the current
# file to <target>.prev before applying the new template. Change is detected by
# hashing the template into a gitignored marker rather than by mtime, which git
# checkouts reset regardless of content.

# sync_env_file <example> <target> <marker>
sync_env_file() {
  local example="$1" target="$2" marker="$3"
  [ -f "$example" ] || return 0

  local new_hash
  new_hash="$(sha256sum "$example" | awk '{print $1}')"

  if [ ! -f "$target" ]; then
    cp "$example" "$target"
    echo "$new_hash" >"$marker"
    echo "  Created $target from $(basename "$example")"
    return 0
  fi

  # Target exists but no recorded template hash (first run after this landed):
  # adopt the current state as the baseline — never clobber an existing file.
  if [ ! -f "$marker" ]; then
    echo "$new_hash" >"$marker"
    return 0
  fi

  if [ "$new_hash" != "$(cat "$marker")" ]; then
    local backup="${target}.prev"
    cp "$target" "$backup"
    cp "$example" "$target"
    echo "$new_hash" >"$marker"
    echo "  $(basename "$example") changed — backed up previous $target to $backup"
    echo "    Re-apply any custom values from the backup (e.g. secrets in .env.local)."
  fi
}
