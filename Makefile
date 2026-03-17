# Local Docker build — mirrors build-images.yaml (host architecture only).
# Tags: sha-<SHORT_SHA>, local
#
# Default: IMAGE_PREFIX=soba → soba/backend, soba/frontend
# GHCR:    IMAGE_PREFIX=ghcr.io/org/repo → ghcr.io/org/repo/backend, ...
# Docker Hub (username/repo only): DOCKERHUB_USER=youruser → youruser/soba-backend, youruser/soba-frontend
IMAGE_PREFIX ?= soba
SHORT_SHA := $(shell git rev-parse --short HEAD)
FULL_SHA := $(shell git rev-parse HEAD)
IMAGE_VERSION := local

ifdef DOCKERHUB_USER
BACKEND_IMAGE := $(DOCKERHUB_USER)/soba-backend
FRONTEND_IMAGE := $(DOCKERHUB_USER)/soba-frontend
else
BACKEND_IMAGE := $(IMAGE_PREFIX)/backend
FRONTEND_IMAGE := $(IMAGE_PREFIX)/frontend
endif

.PHONY: build build-backend build-frontend push push-backend push-frontend build-push run-images run-images-down

build-backend:
	docker build -f backend/Dockerfile -t $(BACKEND_IMAGE):sha-$(SHORT_SHA) -t $(BACKEND_IMAGE):local \
		--label org.opencontainers.image.revision=$(FULL_SHA) \
		--label org.opencontainers.image.version=$(IMAGE_VERSION) \
		.

build-frontend:
	docker build -f frontend/Dockerfile -t $(FRONTEND_IMAGE):sha-$(SHORT_SHA) -t $(FRONTEND_IMAGE):local \
		--label org.opencontainers.image.revision=$(FULL_SHA) \
		--label org.opencontainers.image.version=$(IMAGE_VERSION) \
		.

build: build-backend build-frontend

push-backend:
	docker push $(BACKEND_IMAGE):sha-$(SHORT_SHA)
	docker push $(BACKEND_IMAGE):local

push-frontend:
	docker push $(FRONTEND_IMAGE):sha-$(SHORT_SHA)
	docker push $(FRONTEND_IMAGE):local

push: push-backend push-frontend

build-push: build push

# Run backend and frontend from built images (soba/backend:local, soba/frontend:local).
# Uses backend/.env.example, backend/.env.local.example, frontend/.env.example.
# Requires dev services (postgres, mongo, formio) to be running first.
run-images:
	docker compose -f .devcontainer/docker-compose.images.yml up -d

run-images-down:
	docker compose -f .devcontainer/docker-compose.images.yml down
 