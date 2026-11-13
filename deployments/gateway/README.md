# APS gateway check

## Protected integration API v2

`integration.template.yaml` renders a separate service for `/chefs/api/integrations/v2` with
`key-auth`, the Product Environment `acl`, and `kong-upstream-jwt`. It accepts API keys only in
`X-API-KEY`, strips the key before forwarding, and adds a raw signed token in `GW-JWT`.
The original proxy-check template and its unauthenticated health workflow remain separate.

Render locally (does not publish):

```bash
export GATEWAY_ID=gw-93f93
export GATEWAY_QUALIFIER=integrations-soba-dev
export GATEWAY_SERVICE_NAME=soba-dev-integrations-v2
export GATEWAY_HOSTNAME=soba-dev.api.gov.bc.ca
export GATEWAY_ROUTE_PATH=/integrations/v2/
export BACKEND_HOST=soba-dev-backend.your-namespace.svc
export GATEWAY_ENVIRONMENT_APP_ID='<Product-Environment-appId>'
export GATEWAY_JWT_ISSUER=https://aps-jwks-upstream-jwt.api.gov.bc.ca
node deployments/gateway/scripts/generate-gateway-config.mjs --integration --output /tmp/soba-integrations.yaml
```

Use a dedicated qualifier; publishing under the public proxy-check qualifier would replace that
configuration. The Product Environment must use `kong-api-key-acl`, link this service, and its
approved consumers must belong to its appId group. Obtain the appId from the Portal plugin
template or Directory API, not the gateway ID. APS must have upstream signing keys provisioned.

The backend must use the same `GATEWAY_JWT_ISSUER` as `INTEGRATION_GATEWAY_ISSUER`, configure
its `/certs` JWKS URI, and set `INTEGRATION_GATEWAY_AUDIENCE` to exactly `GATEWAY_SERVICE_NAME`.
In Helm, set `backend.integrationGateway.issuer`, `.jwksUri`, `.audience`, and `.clientIdClaim`;
the backend ConfigMap maps these to the environment variables. Empty defaults keep JWT auth disabled.
The APS instance determines the issuer/JWKS endpoints, even for SOBA dev/PR releases. See
`backend/src/integration/README.md` for the endpoint table and signed identity mapping.

All paths on this integration gateway service, including health and OpenAPI, require a valid API
key and ACL membership. Health and OpenAPI remain public when called directly at the backend.
The existing `verify-health.mjs` is for the public proxy check and cannot verify this protected
service without credentials. Live publish and signed-claim mapping checks remain separate steps.

Run generator checks with `node --test deployments/gateway/tests/generate-gateway-config.test.mjs`.

### PR automation

With `APS_PR_ENABLED=true`, PR Open now publishes both the public proxy check and a protected
integration service after deploying the backend. For PR 123 the integration service is
`soba-pr-123-integrations-v2`, its qualifier is `integrations-soba-pr-123`, and its route is
`/pr/123/integrations/v2/`. The deployed backend audience matches the service name. PR Close removes
both qualifiers under the same per-release gateway lock. The gateway job checks out the PR source
ref so the rendered configuration matches the deployed feature code.

The gateway job reads `PLUGIN_APS_CREDENTIAL_ISSUER_V3_ENVIRONMENT_APP_ID` from the deployed
backend's Vault-injected `/vault/secrets/soba-aps-credential-issuer` file using OpenShift exec.
PR deployments use dev's Vault secret, so the ACL and API key issuer share the same appId.
The OpenShift CI account needs permission to exec into the backend container.
No GitHub `APS_ENVIRONMENT_APP_ID` variable is needed.

Configure the `pr` GitHub environment (or inherited repository settings):

| Kind | Name | Purpose |
| --- | --- | --- |
| Secret | `APS_INTEGRATION_HEALTH_API_KEY` | Dedicated CI API key approved for that Product Environment; never a GWA management client secret |
| Variable, optional | `APS_UPSTREAM_JWT_ISSUER` | Defaults to `https://aps-jwks-upstream-jwt.api.gov.bc.ca` |
| Variable, optional | `APS_UPSTREAM_JWKS_URI` | Defaults to `https://aps-jwks-upstream-jwt.api.gov.bc.ca/certs` |

Existing `APS_GATEWAY_ID`, `APS_HOST`, `APS_GATEWAY_HOST_PREFIX`, GWA credentials and OpenShift settings
are still required. The optional issuer/JWKS overrides must both refer to the APS instance actually
serving the gateway. The CI key is approved through APS once; the workflow does not issue or rotate it.
It need not exist in the PR database because health verifies the gateway JWT without a credential lookup.

The smoke check requests the integration health URL without a key and requires HTTP 401. It then
uses the CI key and requires HTTP 200 with `gatewayAuthenticated: true`. This proves key-auth, ACL,
v2 routing and backend JWT verification, including the configured issuer and audience. API keys
are passed through environment variables and are never printed. The workflow summary records the
health and `/me` URLs. `/me` additionally requires a key issued in that PR's database.
After deployment, create and approve a key through that PR's credential UI, then call `/me` manually.

Example after deployment (use the actual host printed in the workflow summary):

```bash
curl -i -H "X-API-KEY: $API_KEY" \
  https://soba-pr.api.gov.bc.ca/pr/123/integrations/v2/health
```

Expected body: `{"status":"OK","timestamp":"...","gatewayAuthenticated":true}`.

The reusable/manual gateway workflow also accepts `integration_enabled: true`; manual runs require
the backend JWT settings to have been configured already. Run health-check unit tests with
`node --test deployments/gateway/tests/integration-health.test.mjs`.

## Public proxy check

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

- `pr_open.yaml` calls `gateway-proxy-check.yaml` after the PR deploy when `APS_PR_ENABLED` is
  `true` in the `pr` environment or repository. The same variable enables the APS NetworkPolicy
  in that deploy.
- The workflow renders `service.template.yaml` with `scripts/generate-gateway-config.mjs` and
  publishes it with `gwa publish-gateway --qualifier proxy-proof-<release>`, which replaces only
  that qualifier's configuration.
- Gold PR routes use `soba-pr.api.gov.bc.ca/pr/<number>/`, e.g.
  `https://soba-pr.api.gov.bc.ca/pr/173/health`. Dev uses
  `https://soba-dev.api.gov.bc.ca/health`. Manual runs provide an explicit hostname.
- The check passes when `gwa status` reports the service `UP` and its `env_host` returns HTTP
  200 from `/health` with `status: OK`. The job summary records the URL.
- `pr_close.yaml` publishes `services: []` under the same qualifier and waits until the service
  is gone. Publishing and cleanup for a release share a concurrency group, and publishing is
  refused once the PR is closed.

## NetworkPolicy

`deployments/helm/soba/templates/backend/networkpolicy-aps.yaml` lets the APS namespace reach
backend pods on port 4000. PR and Dev values select the Gold APS namespace with labels
`name: b8840c` and `environment: prod`. Any other release needs `gatewayNetworkPolicy` enabled
in its values before a check; the workflow fails when `<release>-aps` is missing.

## Configuration

PR Open and PR Close read `APS_PR_ENABLED` in jobs that select the `pr` GitHub environment, so
it can be set there or at repository level. Other settings can be set on the repository or on
the selected GitHub environment.

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `OC_NAMESPACE` | Namespace holding the release |
| Secret | `OC_TOKEN` | Can read deployments, services, endpoints, configmaps and networkpolicies |
| Secret | `GWA_CLIENT_ID`, `GWA_CLIENT_SECRET` | Service account with `GatewayConfig.Publish` on the selected environment's gateway |
| Variable | `OC_SERVER` | OpenShift API URL |
| Variable | `APS_HOST` | APS host, `api.gov.bc.ca` for Gold |
| Variable | `APS_GATEWAY_HOST_PREFIX` | PR or Dev host prefix (`soba-pr` or `soba-dev`) |
| Variable | `APS_GATEWAY_ID` | Gateway ID on the selected Gold APS instance |
| Variable | `GWA_LINUX_AMD64_SHA256` | SHA256 of `gwa_Linux_x86_64.tgz` from the [gwa-cli v3.2.0](https://github.com/bcgov/gwa-cli/releases/tag/v3.2.0) `checksums.txt` |

| Environment | Gateway | APS instance |
| --- | --- | --- |
| `pr` | `gw-d3969` | Gold |
| `dev` | `gw-93f93` | Gold |
| `test` | `gw-7f49d` | Gold |
| `prod` | not configured | Not configured |

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
export GATEWAY_ID=gw-d3969
export GATEWAY_QUALIFIER=proxy-proof-soba-pr-173
export GATEWAY_SERVICE_NAME=soba-proxy-proof-soba-pr-173
export GATEWAY_HOSTNAME=soba-pr.api.gov.bc.ca
export GATEWAY_ROUTE_PATH=/pr/173/
export BACKEND_HOST=soba-pr-173-backend.your-namespace.svc
node deployments/gateway/scripts/generate-gateway-config.mjs
```

## Troubleshooting

- Job skipped: `APS_PR_ENABLED` is not exactly `true`, or the deploy failed.
- Validation step exits 1 without a message: the release must start with `soba-` and be at most
  49 characters, and `OC_NAMESPACE` must be a valid namespace.
- `/health` fails: check the NetworkPolicy labels, ready backend endpoints, and any plugins
  inherited from the gateway.
