# Independent gateway reverse-proxy proof

The frontend continues using its existing OpenShift API URL. This proof changes
only APS routing and a backend-only ingress NetworkPolicy. It adds no gateway
authentication plugins and changes no application settings.

## Run through GitHub Actions

The manually dispatched **Gateway proxy check** workflow is
`.github/workflows/gateway-proxy-check.yaml`. Make it available on the repository's
default branch before using the Actions UI. Select the reviewed workflow ref.

Configure these settings on the selected GitHub environment (`dev`, `pr`, or `test`):

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `OC_NAMESPACE` | Namespace containing the existing backend release |
| Secret | `OC_TOKEN` | Account able to inspect deployments/services/configmaps/Helm values and apply NetworkPolicies |
| Secret | `APS_CLIENT_ID`, `APS_CLIENT_SECRET` | APS publishing account with `GatewayConfig.Publish` |
| Variable | `OC_SERVER` | OpenShift API URL |
| Variable | `APS_HOST` | Administration host, e.g. `api-gov-bc-ca.test.api.gov.bc.ca` |
| Variable | `APS_GATEWAY_ID` | Intended gateway ID, e.g. `gw-ca88c` |
| Variable | `GWA_LINUX_AMD64_SHA256` | Reviewed SHA256 of the v3.2.0 `gwa_Linux_x86_64.tgz` release asset |

Get the checksum from the v3.2.0 release's `checksums.txt`:
https://github.com/bcgov/gwa-cli/releases/tag/v3.2.0

Supply the existing release (e.g. `soba-pr-156`), a **dedicated APS-provisioned
hostname**, and the APS Silver data plane (`test` or `prod`). The data-plane
selection describes APS, not the application environment. This workflow is
Silver-specific; Gold requires confirming APS placement and changing namespace
label `264e6f` to `b8840c`.

The workflow:

1. Validates settings and generates a single broad reverse proxy.
2. Checks the existing rollout, Service port 4000, ready endpoints, and `/chefs` prefix.
3. Renders and applies only the backend NetworkPolicy using deployed Helm values.
4. Installs checksum-verified GWA v3.2.0 and authenticates.
5. Dry-runs and publishes with qualifier `proxy-proof-<environment>`.
6. Polls for the expected APS service to be UP and requires an HTTP 200 JSON
   response with `status: OK` and a timestamp from `/health`. Redirects fail.

The proxy Service and Route are named `soba-proxy-proof-<environment>`.
Repeated runs update that environment's proof to the supplied backend/hostname.
Use an unused hostname so existing routes/plugins do not intercept this check.
No frontend deployment, application URL, CORS, or application authentication is changed.

Successful mapping:

```text
https://<gateway-host>/health
  -> http://<release>-backend.<namespace>.svc:4000/chefs/api/v1/health
```

Do not include `/chefs/api/v1` in the gateway request. Existing application
routing and authorization still apply to other paths behind this broad route.

## Local rendering

Node.js 20+ is sufficient; no packages or credentials are needed to render.
The `environments/.env.*.example` files contain routing settings only. Source only
trusted shell files. The generator reads exported variables and does not load .env itself.

```bash
export GATEWAY_ID=gw-example
export GATEWAY_QUALIFIER=proxy-proof-dev
export GATEWAY_HOSTNAME=your-dedicated-host.api.gov.bc.ca
export GATEWAY_SERVICE_NAME=soba-proxy-proof-dev
export BACKEND_HOST=soba-dev-backend.your-namespace.svc
node deployments/gateway/scripts/generate-gateway-config.mjs \
  --format kong --output /tmp/gateway-kong.yaml
```

The default `--format resource` emits a `GatewayService` for inspection. Use
`--format kong` with `gwa publish-gateway --qualifier "$GATEWAY_QUALIFIER"`;
do not use unqualified `gwa apply` for this shared-gateway proof.

## Persistence and cleanup

The proxy and NetworkPolicy remain after the run for inspection. The proof does
not add automated publishing or PR cleanup. The NetworkPolicy is applied directly;
Helm's saved values are not updated. For permanent chart management, enable
`gatewayNetworkPolicy` with the confirmed namespace labels in the release values.

To remove a proof, first inspect the dry-run of an empty `services: []` Kong file
with the same qualifier, confirm that only proof resources are deleted, then
publish it. Confirm empty qualified synchronization support with APS. Never destroy
the shared gateway. Delete `<release>-aps` NetworkPolicy only if no remaining
APS route needs that backend access. PR teardown already sweeps release-labelled
NetworkPolicies, but does not clean up APS resources.

If verification fails, inspect APS status, data-plane placement, namespace labels,
backend endpoints, and inherited gateway plugins. Direct OpenShift Route success
does not prove that APS can reach the internal Service.
