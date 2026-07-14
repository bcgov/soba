#!/usr/bin/env bash
# Opt-in local ClamAV for virus-scan testing. Reachable at localhost:3310 — the
# virusscan-clamav plugin's default URL — so backend/.env.local only needs
# VIRUSSCAN_DEFAULT_CODE=virusscan-clamav. Not started by default.
#
# Same image as the deployment (ghcr.io/bcgov/chefs-clamav), but with a freshclam
# config pointed at the public ClamAV mirror — the image's baked-in mirror is the
# in-cluster BC Gov one, which is unreachable off-cluster.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
name=soba-clamav
image=ghcr.io/bcgov/chefs-clamav:latest

# chefs-clamav is amd64-only: amd64 hosts run it natively, arm64 (Apple Silicon)
# emulates. Auto-detected inside the devcontainer; override with CLAMAV_PLATFORM.
platform_arg=()
if [[ -n "${CLAMAV_PLATFORM:-}" ]]; then
  platform_arg=(--platform="$CLAMAV_PLATFORM")
elif [[ "$(uname -m)" != "x86_64" && "$(uname -m)" != "amd64" ]]; then
  platform_arg=(--platform=linux/amd64)
fi

docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" --restart unless-stopped "${platform_arg[@]}" \
  -p 3310:3310 \
  -e CLAMAV_NO_CLAMD=false \
  -e CLAMAV_NO_MILTERD=true \
  -v "$here/config/freshclam.conf:/usr/local/etc/freshclam.conf:ro" \
  "$image"

echo "ClamAV starting — the first virus-definition pull can take a few minutes."
echo "Follow readiness: docker logs -f $name   (until clamd listens on 3310)"
