# Temporal on OpenShift for SOBA

This document describes how Temporal is currently installed and used for SOBA in the OpenShift namespace pattern `acf456-xx` and what must change when the newer upstream Temporal Helm chart line moves from release candidate to the supported stable release.

This guide is intended for:

- Developers working on CI/CD, Helm, or Temporal worker code
- Testers validating PR and `develop` deployments
- Platform operators troubleshooting Temporal inside the shared namespace

Examples below use `acf456-dev`, but the same deployment pattern applies to the `acf456-xx` namespace family.

## Executive Summary

SOBA currently uses a shared, namespace-level Temporal server plus per-application Temporal workers:

- One shared Temporal release named `temporal` is installed into the OpenShift namespace
- Each PR gets its own Temporal namespace such as `soba-pr-46`
- Each SOBA release gets its own application worker deployment such as `soba-pr-46-temporal-worker`
- The shared Temporal server uses Crunchy Postgres databases `temporal` and `temporal_visibility`
- PR cleanup deletes the PR-specific Temporal namespace and SOBA release, but keeps the shared Temporal server in place

Today, CI installs Temporal from the published Helm repository using chart `0.74.0`. The checked-out `helm-charts` repository in the workspace is not what CI deploys today; it is the upstream newer chart line and should be treated as the migration reference for the next upgrade.

## Current Deployment Model

### Shared components per OpenShift namespace

The shared Temporal deployment is installed once per namespace and is reused by all PR releases in that namespace.

Current shared Temporal services and pods are expected to include:

- `temporal-frontend`
- `temporal-history`
- `temporal-matching`
- `temporal-worker` for the Temporal server internals, not the SOBA application worker
- `temporal-web`
- `temporal-admintools`
- schema jobs created by the chart

### Per-PR SOBA components

For each pull request deployment, SOBA adds:

- `soba-pr-<N>-backend`
- `soba-pr-<N>-frontend`
- `soba-pr-<N>-formio`
- `soba-pr-<N>-mongodb`
- `soba-pr-<N>-temporal-worker`

Each PR also gets a dedicated Temporal namespace inside the shared server:

- `soba-pr-45`
- `soba-pr-46`
- and so on

This design keeps Temporal infrastructure shared while isolating workflow state by namespace.

## What Has Already Been Implemented

### 1. PR deployments now install shared Temporal automatically

The PR deployment workflow in `.github/workflows/pr_open.yaml` does all of the following:

- Builds SOBA images
- Deploys or reconciles Crunchy Postgres
- Runs `helm upgrade --install temporal temporal` against `https://go.temporal.io/helm-charts`
- Uses `deployments/helm/temporal/values.yaml` for the Temporal values
- Waits for Temporal schema jobs and `temporal-frontend`
- Ensures the PR-specific Temporal namespace exists
- Deploys the SOBA Helm release with the Temporal address and namespace injected
- Waits for the SOBA Temporal worker rollout

This means a PR deploy is no longer just an app deployment. It is also responsible for ensuring the shared Temporal control plane exists in the target namespace.

### 2. SOBA has a dedicated Temporal worker image

SOBA no longer relies on the backend image for Temporal worker execution. A dedicated worker image is built from `backend/Dockerfile.temporal-worker`.

Why this was done:

- The Temporal TypeScript SDK depends on `@temporalio/core-bridge`
- That native dependency requires a glibc-based runtime
- Alpine-based images are not reliable for this workload

What the dedicated worker image does:

- Uses `node:lts-slim`
- Installs backend dependencies
- Builds the backend TypeScript output
- Starts `backend/dist/temporal-worker.js`
- Remains compatible with OpenShift arbitrary UID behavior

This is the key application-side change that made the SOBA worker stable on OpenShift.

### 3. Image build and publish now include `temporal-worker`

The reusable workflow `.github/workflows/build-images.yaml` now builds and publishes three image families:

- `backend`
- `frontend`
- `temporal-worker`

For each image family, the workflow:

- builds per-platform images
- uploads digests
- merges them into a final manifest image
- tags images with `sha-<short_sha>`
- tags environment-oriented aliases such as `pr-<N>` or `develop`

### 4. SOBA Helm values support Temporal worker deployment

The SOBA Helm chart under `deployments/helm/soba` now includes:

- a `temporal` config block for shared connection settings
- a `temporalWorker` block for the dedicated worker deployment
- a `templates/temporal/configmap.yaml` that injects:
  - `TEMPORAL_ALLOWED`
  - `TEMPORAL_ADDRESS`
  - `TEMPORAL_NAMESPACE`
  - `TEMPORAL_TASK_QUEUE`
- a `templates/temporal/deployment-worker.yaml` that deploys the SOBA worker as its own Deployment

Current enablement pattern:

- `values.yaml`: disabled by default
- `values-pr.yaml`: enabled
- `values-dev.yaml`: enabled

### 5. PR cleanup removes PR-specific Temporal namespaces

The cleanup workflow `.github/workflows/pr_close.yaml` now:

- deletes the Temporal namespace `soba-pr-<N>` through `temporal-admintools`
- uninstalls the PR-specific SOBA Helm release
- removes the PR-specific Crunchy user and database resources

It does not uninstall the shared `temporal` release. That is intentional.

## Current Shared Temporal Server Configuration

The file `deployments/helm/temporal/values.yaml` defines the current Temporal server deployment used by PR CI.

### Current chart and image line

- Helm repo: `https://go.temporal.io/helm-charts`
- Chart version in CI today: `0.74.0` by default
- Release name: `temporal`
- Server image: `temporalio/server:1.30.3`

The workflow allows override via the repository variable `TEMPORAL_CHART_VERSION`, but defaults to `0.74.0`.

### Current persistence model

Temporal uses Crunchy Postgres with two SQL databases:

- `temporal`
- `temporal_visibility`

Current connection characteristics:

- host: `pg-soba-crunchy-primary`
- port: `5432`
- user: `temporal`
- secret: `pg-soba-crunchy-pguser-temporal`

### Current non-bundled dependency posture

The current values explicitly disable bundled sub-chart style dependencies:

- Cassandra
- MySQL
- Elasticsearch
- Prometheus
- Grafana

That matches the current SOBA platform model where external platform services are used instead of chart-managed databases and monitoring stacks.

### Current server features enabled

- Temporal Web UI enabled
- Temporal AdminTools enabled
- schema creation and update jobs enabled
- database creation disabled

This is consistent with:

- platform-managed Postgres databases and credentials
- chart-managed Temporal schema setup and schema upgrades

## Current PR Deployment Flow

The current PR flow is:

1. Build `backend`, `frontend`, and `temporal-worker` images
2. Reconcile Crunchy Postgres
3. Install or upgrade the shared `temporal` release
4. Wait for Temporal to finish schema work and come up
5. Create or confirm the Temporal namespace `soba-pr-<N>`
6. Deploy the SOBA release
7. Inject:
   - `temporal.address = temporal-frontend.<namespace>.svc.cluster.local:7233`
   - `temporal.namespace = soba-pr-<N>`
   - `temporalWorker.image.repository = ghcr.io/<repo>/temporal-worker`
   - `temporalWorker.image.tag = sha-<short_sha>`
8. Wait for `backend`, `frontend`, `formio`, `mongodb`, and `temporal-worker`
9. Run Playwright tests

This is the most complete and correct Temporal deployment path in the repository today.

## Current Gaps and Operational Notes

### 1. `develop` deployment is not yet at PR parity

The `develop` deployment workflow in `.github/workflows/on-merge.yaml` currently builds images and deploys SOBA, but it does not yet mirror the full PR Temporal flow.

Important gaps:

- it does not install or upgrade the shared `temporal` release
- it does not ensure the `soba-dev` Temporal namespace exists
- it does not override the `temporalWorker` image tag to the just-built SHA
- it does not wait for the SOBA Temporal worker rollout

Because `values-dev.yaml` enables the worker, the dev deployment currently depends on:

- a pre-existing shared Temporal installation
- whatever `temporalWorker.image.tag` resolves to in values rather than the just-built image

This should be fixed independently of the future chart upgrade.

### 2. Secret rotation requires pod restarts

During troubleshooting in `acf456-dev`, Temporal returned `503` in the Web UI because `temporal-frontend` and later `temporal-matching` were still running with stale database credentials after the Postgres secret changed.

Symptoms included:

- `pq: password authentication failed for user "temporal"`
- Temporal Web UI `503` from `/api/v1/namespaces`
- `Not enough hosts to serve the request`

Operational fix:

- restart `deployment/temporal-frontend`
- restart `deployment/temporal-matching`

Recommendation:

- document this as the first operational response after any Temporal DB password rotation
- consider adding an explicit operational runbook section for stale-secret recovery

### 3. The shared server is namespace-scoped, not cluster-global

This documentation should keep emphasizing that Temporal is shared within an OpenShift namespace, not across all namespaces. `acf456-dev` has its own shared Temporal release. Another namespace would require its own shared deployment unless platform architecture changes.

## What the Local `helm-charts` Repo Means

The checked-out repository at `../helm-charts` is important, but it is not the chart source used by current CI.

What it tells us:

- the upstream chart in that checkout is currently `1.0.0-rc.3`
- its `appVersion` is `1.30.2`
- it introduces a new persistence values structure
- it removes support for the old top-level database and monitoring keys

This repo should be treated as the upgrade target and migration reference, not as proof that SOBA already deploys the new chart line.

## What Must Change When the RC Chart Becomes the Supported Stable Release

Once the current upstream RC line becomes the supported stable release, the work is not just to bump the version. The current SOBA values file is still written in the old chart format.

### Required change 1. Update the chart version used by CI

Current state:

- PR CI defaults to `0.74.0`

Next step:

- update the repository variable `TEMPORAL_CHART_VERSION` or the workflow default in `.github/workflows/pr_open.yaml`
- move to the chosen stable `1.0.x` release after non-production validation

### Required change 2. Migrate `deployments/helm/temporal/values.yaml` to the new persistence format

The new chart expects persistence under:

`server.config.persistence.datastores`

The current SOBA values file still uses the old structure:

- `server.config.persistence.default`
- `server.config.persistence.visibility`
- old SQL field names such as `driver`, `host`, `port`, and `database`

The new chart expects SQL datastores shaped more like:

```yaml
server:
  image:
    repository: temporalio/server
    tag: 1.30.3
  config:
    persistence:
      defaultStore: default
      visibilityStore: visibility
      datastores:
        default:
          sql:
            createDatabase: false
            manageSchema: true
            pluginName: postgres12
            driverName: postgres12
            databaseName: temporal
            connectAddr: "pg-soba-crunchy-primary:5432"
            user: temporal
            existingSecret: pg-soba-crunchy-pguser-temporal
            maxConns: 20
            maxIdleConns: 20
            maxConnLifetime: "1h"
        visibility:
          sql:
            createDatabase: false
            manageSchema: true
            pluginName: postgres12
            driverName: postgres12
            databaseName: temporal_visibility
            connectAddr: "pg-soba-crunchy-primary:5432"
            user: temporal
            existingSecret: pg-soba-crunchy-pguser-temporal
            maxConns: 20
            maxIdleConns: 20
            maxConnLifetime: "1h"
```

This is the most important migration task.

### Required change 3. Remove deprecated top-level keys entirely

The new chart line does not accept the old top-level keys for bundled dependencies.

These keys must be removed from `deployments/helm/temporal/values.yaml`, not merely left present with `enabled: false`:

- `cassandra`
- `mysql`
- `elasticsearch`
- `prometheus`
- `grafana`

Why this matters:

- the newer chart validates deprecations during template rendering
- leaving these keys in place can fail the install or upgrade even when they are set to disabled

### Required change 4. Replace old schema flags with datastore-level schema management

Current SOBA values use:

```yaml
schema:
  createDatabase:
    enabled: false
  setup:
    enabled: true
  update:
    enabled: true
```

In the newer chart line:

- schema job resources still live under top-level `schema`
- schema execution behavior is controlled per datastore using:
  - `createDatabase`
  - `manageSchema`

For SOBA, the likely target is:

- `createDatabase: false`
- `manageSchema: true`

That keeps database ownership with Crunchy while allowing the chart to apply Temporal schema migrations.

### Required change 5. Disable compatibility shims for Temporal 1.30+

The newer chart line includes compatibility shims intended for 1.29-era images.

Because SOBA is already using Temporal `1.30.x`, the future stable values should explicitly review and likely set:

```yaml
shims:
  dockerize: false
  elasticsearchTool: false
```

This should be validated during the upgrade rehearsal.

### Required change 6. Re-test PR deployment and cleanup end to end

When the stable chart version is adopted, validate all of the following in a non-production namespace:

- shared Temporal install succeeds
- schema jobs complete successfully
- `temporal-frontend`, `temporal-history`, `temporal-matching`, `temporal-web`, `temporal-admintools`, and Temporal internal `worker` all come up
- PR namespace creation through `temporal-admintools` still works
- `soba-pr-<N>-temporal-worker` connects and polls successfully
- the Web UI returns `200` from `/api/v1/namespaces`
- PR cleanup still deletes the PR-specific Temporal namespace cleanly

### Required change 7. Bring `develop` deployment up to the same standard

This is not strictly tied to the stable chart release, but it should be done as part of the same effort so dev behavior matches PR behavior.

`on-merge.yaml` should be updated to:

- install or reconcile the shared `temporal` release
- ensure `soba-dev` exists as a Temporal namespace
- inject the built `temporal-worker` image tag into the Helm override
- wait for `soba-dev-temporal-worker` rollout

Without this, developers and testers can see different behavior in PR versus dev.

## Recommended Rollout Plan for the Stable Chart Upgrade

1. Create a branch that only updates the Temporal chart version and `deployments/helm/temporal/values.yaml`.
2. Convert the values file to the new `datastores` structure.
3. Remove deprecated top-level keys.
4. Review shims for Temporal `1.30.x`.
5. Test the branch in a disposable non-production namespace.
6. Verify Web UI, PR namespace creation, worker polling, and cleanup behavior.
7. After validation, update `TEMPORAL_CHART_VERSION` to the stable version.
8. Update `on-merge.yaml` so dev matches PR behavior.

## Verification Commands

### Shared Temporal health

```bash
oc get pods -n acf456-dev | grep temporal
oc logs -n acf456-dev deployment/temporal-frontend --since=5m
oc logs -n acf456-dev deployment/temporal-matching --since=5m
```

### PR namespace validation

```bash
oc exec deployment/temporal-admintools -n acf456-dev -- \
  temporal operator namespace list

oc exec deployment/temporal-admintools -n acf456-dev -- \
  temporal operator namespace describe -n soba-pr-46
```

### Web UI validation

```bash
oc port-forward -n acf456-dev svc/temporal-web 8088:8080
curl -i http://localhost:8088/api/v1/namespaces
```

### SOBA worker validation

```bash
oc get deployment -n acf456-dev | grep temporal-worker
oc logs deployment/soba-pr-46-temporal-worker -n acf456-dev --since=5m
```

Healthy worker logs should show:

- connection to the configured Temporal frontend
- the expected namespace
- the expected task queue
- `Worker started, polling for tasks`

## Final Recommendation

The current OpenShift Temporal implementation is partly complete and already good enough for PR-based testing:

- shared Temporal server deployment exists
- PR namespace lifecycle exists
- dedicated SOBA worker image exists
- PR deployment path is mostly correct

The next meaningful work is not new feature work. It is upgrade hardening:

- migrate the Temporal values file to the new chart format
- adopt the stable `1.0.x` chart line after validation
- bring `develop` deployment to feature parity with PR deployment
- document secret-rotation recovery for `temporal-frontend` and `temporal-matching`

Once those items are done, the Temporal OpenShift story for SOBA will be much easier for developers and testers to understand, operate, and trust.
