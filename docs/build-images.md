# Building and Pulling Docker Images

How to build backend and frontend images, target different platforms, and pull them for local use.

## Build via GitHub Actions (recommended)

The [Build Images workflow](.github/workflows/build-images.yaml) builds for GHCR. Use it for multi-platform or when local builds fail.

**Manual run:** Actions → Build Images → Run workflow

| Input         | Options                            | Use case                                                           |
| ------------- | ---------------------------------- | ------------------------------------------------------------------ |
| **platforms** | `amd64`, `arm64`, `amd64-arm64`    | OpenShift or Mac Intel (amd64), local Mac Silicon (arm64), or both |
| **ref**       | Branch, `refs/pull/N/head`, or SHA | Which commit to build (blank = default branch)                     |

Images are pushed to `ghcr.io/<org>/<repo>/backend` and `ghcr.io/<org>/<repo>/frontend` with tags `sha-<short-sha>`, `pr-<N>` (PRs), or `main`/`latest` (main branch).

## Pull images for local use

After the workflow runs, pull the images:

```bash
# Pull by tag (use the tag from the workflow run, e.g. sha-abc1234)
docker pull ghcr.io/bcgov/soba/backend:sha-abc1234
docker pull ghcr.io/bcgov/soba/frontend:sha-abc1234

# Or pull latest from main
docker pull ghcr.io/bcgov/soba/backend:latest
docker pull ghcr.io/bcgov/soba/frontend:latest
```

---

## Build locally (Makefile)

The Makefile builds images for your **host architecture only**. It mirrors the workflow (tags, labels, image names) but does not support multi-arch.

**Why host-only?** Building for multiple architectures locally (e.g. amd64 + arm64) uses QEMU to emulate the non-native platform. The frontend build often fails when cross-building amd64 on an ARM Mac (Apple Silicon): Next.js/Node.js can segfault under QEMU emulation. For multi-arch, use the GitHub Actions workflow instead.

**Default:** Images are tagged `soba/backend` and `soba/frontend` with tags `sha-<short-sha>` and `local`.

```bash
make build
# or: make build-backend, make build-frontend
```

### Override image prefix (GHCR, etc.)

For GHCR or other registries that support `org/repo/image`:

```bash
IMAGE_PREFIX=ghcr.io/bcgov/soba make build
```

### Build and push to Docker Hub

Docker Hub only allows `username/repository` (two levels), not `username/org/image`. Use `soba-backend` and `soba-frontend` as repository names:

1. Log in: `docker login`
2. Build with your Docker Hub username:

   ```bash
   DOCKERHUB_USER=youruser make build
   ```

   This produces `youruser/soba-backend` and `youruser/soba-frontend`.

3. Push the images:

   ```bash
   docker push usingtechnology/soba-backend:sha-$(git rev-parse --short HEAD)
   docker push usingtechnology/soba-backend:local
   docker push usingtechnology/soba-frontend:sha-$(git rev-parse --short HEAD)
   docker push usingtechnology/soba-frontend:local
   ```
