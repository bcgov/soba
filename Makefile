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

.PHONY: build build-backend build-frontend

build-backend:
	docker build -t $(BACKEND_IMAGE):sha-$(SHORT_SHA) -t $(BACKEND_IMAGE):local \
		--label org.opencontainers.image.revision=$(FULL_SHA) \
		--label org.opencontainers.image.version=$(IMAGE_VERSION) \
		./backend

build-frontend:
	docker build -t $(FRONTEND_IMAGE):sha-$(SHORT_SHA) -t $(FRONTEND_IMAGE):local \
		--label org.opencontainers.image.revision=$(FULL_SHA) \
		--label org.opencontainers.image.version=$(IMAGE_VERSION) \
		./frontend

build: build-backend build-frontend
