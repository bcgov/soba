# clamav

![Version: 1.0.0](https://img.shields.io/badge/Version-1.0.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 1.0.5](https://img.shields.io/badge/AppVersion-1.0.5-informational?style=flat-square)

Chart for deploying a Clam AV on kubernetes

## Maintainers

| Name   | Email | Url                               |
| ------ | ----- | --------------------------------- |
| BC Gov |       | <https://github.com/bcgov/clamav> |

## Requirements

Kubernetes: `>= 1.18.0`

## Values

| Key                                               | Type   | Default                                                                                  | Description                                                                                                                  |
| ------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| clamav.freshclam.mirrors                          | list   | `["https://clamav-mirror.apps.silver.devops.gov.bc.ca"]`                                 | A list of clamav mirrors to be used by the clamav service. By default, use the ClamAV Mirror provided in OCP4 Silver cluster |
| clamav.image                                      | string | `"ghcr.io/bcgov/chefs-clamav"`                                                           | The clamav docker image                                                                                                      |
| clamav.imagePullPolicy                            | string | `"IfNotPresent"`                                                                         | IfNotPresent                                                                                                                 |
| clamav.limits.connectionQueueLength               | int    | `100`                                                                                    | Maximum length the queue of pending connections may grow to                                                                  |
| clamav.limits.fileSize                            | int    | `30`                                                                                     | The largest file size scanable by clamav, in MB                                                                              |
| clamav.limits.maxThreads                          | int    | `4`                                                                                      | Maximum number of threads running at the same time.                                                                          |
| clamav.limits.scanSize                            | int    | `150`                                                                                    | The largest scan size permitted in clamav, in MB                                                                             |
| clamav.limits.sendBufTimeout                      | int    | `500`                                                                                    |                                                                                                                              |
| clamav.replicaCount                               | int    | `1`                                                                                      |                                                                                                                              |
| clamav.resources                                  | object | `{"limits":{"cpu":"500m","memory":"2048Mi"},"requests":{"cpu":"100m","memory":"2048Mi"}}` | The resource requests and limits for the clamav service                                                                     |
| clamav.tag                                        | string | `"latest"`                                                                               |                                                                                                                              |
| containerSecurityContext.allowPrivilegeEscalation | bool   | `false`                                                                                  |                                                                                                                              |
| containerSecurityContext.capabilities.drop[0]     | string | `"ALL"`                                                                                  |                                                                                                                              |
| containerSecurityContext.enabled                  | bool   | `true`                                                                                   |                                                                                                                              |
| containerSecurityContext.runAsNonRoot             | bool   | `true`                                                                                   |                                                                                                                              |
| containerSecurityContext.seccompProfile.type      | string | `"RuntimeDefault"`                                                                       |                                                                                                                              |
| fullnameOverride                                  | string | `""`                                                                                     | override the full name of the clamav chart                                                                                   |
| nameOverride                                      | string | `""`                                                                                     | override the name of the clamav chart                                                                                        |
| pdb.create                                        | bool   | `false`                                                                                  |                                                                                                                              |
| pdb.maxUnavailable                                | string | `""`                                                                                     |                                                                                                                              |
| pdb.minAvailable                                  | int    | `1`                                                                                      |                                                                                                                              |
| podSecurityContext.enabled                        | bool   | `true`                                                                                   |                                                                                                                              |
| podSecurityContext.seccompProfile.type            | string | `"RuntimeDefault"`                                                                       |                                                                                                                              |
| service.port                                      | int    | `3310`                                                                                   | The port to be used by the clamav service                                                                                    |

---

Autogenerated from chart metadata using [helm-docs v1.13.1](https://github.com/norwoodj/helm-docs/releases/v1.13.1)

## Additional Changes

| Key        | Type | Default | Description                                                            |
| ---------- | ---- | ------- | --------------------------------------------------------------------- |
| nsp.create | bool | `true`  | Create a NetworkPolicy allowing clamd ingress (3310) from same namespace |
| pdb.create | bool | `false` | Create a PodDisruptionBudget (set `pdb.minAvailable`; use with >1 replica) |

## Deploying

ClamAV runs as its own release, one per namespace — the SOBA backend reaches it via an in-namespace
`clamav` Service (see the `soba.virusScanUsesClamav` gate in the soba chart). `oc` and `helm` are
already installed in the devcontainer, so you can deploy from there.

Grab a login command from the OpenShift console (top-right menu → **Copy login command**), then:

```sh
oc login --token=sha256~xxxxxxxxxxxx --server=https://api.silver.devops.gov.bc.ca:6443
```

Deploy or upgrade into the target namespace. Use the release name `clamav` so the Service is named
`clamav` — that's what the soba chart's default alias (`clamav.<namespace>.svc.cluster.local`) expects.
Run from the repo root:

```sh
# dev — single replica
helm upgrade --install clamav ./deployments/helm/clamav \
  -f ./deployments/helm/clamav/values-dev.yaml -n acf456-dev

# test — 3 replicas + PodDisruptionBudget
helm upgrade --install clamav ./deployments/helm/clamav \
  -f ./deployments/helm/clamav/values-test.yaml -n acf456-test

# prod — 3 replicas + PodDisruptionBudget
helm upgrade --install clamav ./deployments/helm/clamav \
  -f ./deployments/helm/clamav/values-prod.yaml -n acf456-prod
```

The first start pulls virus definitions and can take a few minutes — watch it come up:

```sh
oc -n acf456-dev rollout status deploy/clamav
oc -n acf456-dev logs -l app.kubernetes.io/name=clamav -f   # wait for "Listening daemon"
```

Uninstall with `helm uninstall clamav -n <namespace>`.
