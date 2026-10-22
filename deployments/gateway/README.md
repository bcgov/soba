# APS gateway check

Publishes a reverse proxy on the BC Gov API Gateway (APS) in front of a SOBA backend and
checks `/health` through it. The route has no gateway plugins, and the frontend still calls
the backend through its OpenShift route.

```text
https://<public host>/health
  -> http://<release>-backend.<namespace>.svc:4000/chefs/api/v1/health
```

Every path under the public host maps to `/chefs/api/v1`, so application authentication still
applies to everything except the public endpoints.

## How it runs

- `pr_open.yaml` calls `gateway-proxy-check.yaml` after the PR deploy when the repository
  variable `APS_PR_ENABLED` is `true`. The same variable enables the APS NetworkPolicy in that
  deploy.
- The workflow renders `service.template.yaml` with `scripts/generate-gateway-config.mjs` and
  publishes it with `gwa publish-gateway --qualifier proxy-proof-<release>`, which replaces only
  that qualifier's configuration.
- The route host is `<release>.api.gov.bc.ca`. The APS test instance serves it as
  `<release>-api-gov-bc-ca.test.api.gov.bc.ca`, e.g.
  `soba-pr-173-api-gov-bc-ca.test.api.gov.bc.ca`. Production requires an explicit hostname.
- The check passes when `gwa status` reports the service `UP` and its `env_host` returns HTTP
  200 from `/health` with `status: OK`. The job summary records the URL.
- `pr_close.yaml` publishes `services: []` under the same qualifier and waits until the service
  is gone. Publishing and cleanup for a release share a concurrency group, and publishing is
  refused once the PR is closed.

## NetworkPolicy

`deployments/helm/soba/templates/backend/networkpolicy-aps.yaml` lets the APS namespace reach
backend pods on port 4000. `deployments/helm/soba/values-pr.yaml` sets the Silver test-instance
labels (`name: 264e6f`, `environment: test`). Any other release needs `gatewayNetworkPolicy` enabled in its values
before a check; the workflow fails when `<release>-aps` is missing.

## Configuration

`APS_PR_ENABLED` must be a repository variable because job-level `if` conditions cannot read
environment variables. Everything else can be set on the repository or on the selected GitHub
environment.

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `OC_NAMESPACE` | Namespace holding the release |
| Secret | `OC_TOKEN` | Can read deployments, services, endpoints, configmaps and networkpolicies |
| Secret | `GWA_CLIENT_ID_<ENV>`, `GWA_CLIENT_SECRET_<ENV>` | Service account with `GatewayConfig.Publish` on that environment's gateway |
| Variable | `OC_SERVER` | OpenShift API URL |
| Variable | `APS_GATEWAY_ID` | Gateway ID on the selected APS instance |
| Variable | `GWA_LINUX_AMD64_SHA256` | SHA256 of `gwa_Linux_x86_64.tgz` from the [gwa-cli v3.2.0](https://github.com/bcgov/gwa-cli/releases/tag/v3.2.0) `checksums.txt` |

`<ENV>` is the uppercase GitHub environment name.

| Environment | Gateway | APS instance |
| --- | --- | --- |
| `pr` | `chefs-pr` (`gw-e1890`) | test |
| `dev` | `chefs-dev` (`gw-e86a9`) | test |
| `test` | `chefs-test` (`gw-68f56`) | test |
| `prod` | not configured | prod |

## Manual check

Manual runs need the workflow on the default branch. Run **Gateway proxy check** with an
environment (`dev`, `pr` or `test`), an existing release, and a route hostname in the
`<name>.api.gov.bc.ca` form. Manual runs ignore `APS_PR_ENABLED`, and PR Close does not remove
their configuration.

## Cleanup

PR Close removes a PR's gateway configuration only while `APS_PR_ENABLED` is `true`, so keep it
on until every open PR's configuration is gone. To retry a failed cleanup, run **PR Close**
manually with the PR number. The NetworkPolicy is removed with the Helm release.

## Local rendering

Needs Node.js 20+ and no credentials.

```bash
export GATEWAY_ID=gw-e1890
export GATEWAY_QUALIFIER=proxy-proof-soba-pr-173
export GATEWAY_SERVICE_NAME=soba-proxy-proof-soba-pr-173
export GATEWAY_HOSTNAME=soba-pr-173.api.gov.bc.ca
export BACKEND_HOST=soba-pr-173-backend.your-namespace.svc
node deployments/gateway/scripts/generate-gateway-config.mjs
```

## Troubleshooting

- Job skipped: `APS_PR_ENABLED` is not exactly `true`, or the deploy failed.
- Validation step exits 1 without a message: the release must start with `soba-` and be at most
  49 characters, and `OC_NAMESPACE` must be a valid namespace.
- `/health` fails: check the NetworkPolicy labels, ready backend endpoints, and any plugins
  inherited from the gateway.
