# Independent gateway reverse-proxy proof

The frontend continues using its existing OpenShift API URL. This proof changes
only APS routing and a backend-only ingress NetworkPolicy. It adds no gateway
authentication plugins and changes no application settings.

## Run automatically after a PR deploy

`pr_open.yaml` calls the gateway check after its `deploy` job succeeds. Set the
**repository variable** `APS_PR_ENABLED=true` to enable this proof. Missing or
false leaves existing PR deployment behavior unchanged.

Configure the secrets and variables in the setup table below on the `pr` GitHub
environment. The workflow derives the APS test hostname from the release:
`soba-pr-156` uses `soba-pr-156-api-gov-bc-ca.test.api.gov.bc.ca`.
No hostname suffix setting is needed.

The release comes directly from the PR deployment job. The upstream is derived
as `<release>-backend.<OC_NAMESPACE>.svc`, not the public OpenShift URL. The
workflow summary links to the generated gateway health URL. APS must support
and provision the selected hostname pattern; this setting alone does not create DNS.
A failed gateway check fails its job without changing the deployed frontend.

PR Close removes the PR's gateway configuration when `APS_PR_ENABLED=true`.
Publishing and removal share a per-release concurrency lock, and publishing
checks that the PR is still open before writing gateway configuration.

## GitHub configuration

Set `APS_PR_ENABLED` under **Settings → Secrets and variables → Actions → Variables**.
It is a repository variable because the calling PR workflow checks it before the
`pr` environment job starts.

Configure the following under **Settings → Environments → pr** for automatic PR
checks, or the selected environment for manual checks. Existing accessible
repository secrets and variables can be reused; environment settings override them.



| Kind | Name | Value |
| --- | --- | --- |
| Secret | `OC_NAMESPACE` | Namespace containing the existing backend release |
| Secret | `OC_TOKEN` | Account able to inspect deployments/services/configmaps/Helm values and apply NetworkPolicies |
| Secret | `GWA_CLIENT_ID_<ENV>`, `GWA_CLIENT_SECRET_<ENV>` | Gateway publishing account with `GatewayConfig.Publish`; use the names below |
| Variable | `OC_SERVER` | OpenShift API URL |
| Variable | `APS_GATEWAY_ID` | Gateway ID on the selected APS instance, e.g. `gw-ca88c` |
| Variable | `GWA_LINUX_AMD64_SHA256` | Reviewed SHA256 of the v3.2.0 `gwa_Linux_x86_64.tgz` release asset |

Gateway service-account secret names use an uppercase environment suffix:

| GitHub environment | Client ID secret | Client secret | Gateway |
| --- | --- | --- | --- |
| `pr` | `GWA_CLIENT_ID_PR` | `GWA_CLIENT_SECRET_PR` | `chefs-pr` (`gw-e1890`) |
| `dev` | `GWA_CLIENT_ID_DEV` | `GWA_CLIENT_SECRET_DEV` | `chefs-dev` (`gw-e86a9`) |
| `test` | `GWA_CLIENT_ID_TEST` | `GWA_CLIENT_SECRET_TEST` | `chefs-test` (`gw-68f56`) |
| `prod` | `GWA_CLIENT_ID_PROD` | `GWA_CLIENT_SECRET_PROD` | Production gateway, when configured |

The workflow selects the credential pair from its application environment. Store
these as repository secrets or in the corresponding GitHub environment. PR Open
passes repository secrets with `secrets: inherit`; the gateway job also loads its
selected environment. Use credentials belonging to that environment's gateway.
No fallback to the old generic credential names is used. PR Close uses `GWA_CLIENT_ID_PR` and `GWA_CLIENT_SECRET_PR` for gateway cleanup.

Get the checksum from the v3.2.0 release's `checksums.txt`:
https://github.com/bcgov/gwa-cli/releases/tag/v3.2.0

## Environment selection

The workflow derives both the administration endpoint and the NetworkPolicy
namespace selector from the application environment:

| Application environment | APS administration host | Namespace `environment` label |
| --- | --- | --- |
| `pr`, `dev`, `test` | `api-gov-bc-ca.test.api.gov.bc.ca` | `test` |
| `prod` | `api.gov.bc.ca` | `prod` |

No separate APS endpoint or network environment variable is required. The workflow
sets the GWA host and gateway ID before logging in. Credentials and gateway IDs
must belong to the selected APS instance.

Only `pr_open.yaml` currently invokes the reusable workflow automatically. Dev and
test can be checked manually. The reusable workflow recognizes `prod`, but the
manual selector offers only `dev`, `pr`, and `test`; production deployment is not
wired to this check. A production caller must provide an explicit gateway hostname.

The NetworkPolicy currently uses the Silver namespace label `name: 264e6f` and
allows only backend pods on port 4000. Gold needs separately confirmed gateway
placement and a corresponding policy change; it is not selectable in this workflow.

## Run a check

For an automatic PR check, enable `APS_PR_ENABLED=true` and run **PR Open** or push
an update that triggers PR deployment. The gateway job waits for deployment success.

For a manual check:

1. Make `.github/workflows/gateway-proxy-check.yaml` available on the repository's
   default branch, then open **Actions → Gateway proxy check → Run workflow**.
2. Select the reviewed workflow ref and GitHub environment.
3. Supply an existing release, such as `soba-pr-156`.
4. Supply a dedicated APS-provisioned hostname without a scheme or path.

Manual checks do not require `APS_PR_ENABLED`. They use the
explicit hostname and inspect an existing application deployment.

The workflow:

1. Validates settings and generates a single broad reverse proxy.
2. Checks the existing rollout, Service port 4000, ready endpoints, and `/chefs` prefix.
3. Renders and applies only the backend NetworkPolicy using deployed Helm values.
4. Installs checksum-verified GWA v3.2.0 and authenticates.
5. Dry-runs and publishes with qualifier `proxy-proof-<release>`.
6. Polls for the expected APS service to be UP, reads its public `env_host`,
   and requires an HTTP 200 JSON response with `status: OK` and a timestamp from `/health`. Redirects fail.

The proxy Service and Route are named `soba-proxy-proof-<release>`.
Repeated runs update that release's proof to the supplied backend/hostname.
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
export GATEWAY_QUALIFIER=proxy-proof-soba-dev
export GATEWAY_HOSTNAME=soba-dev-api-gov-bc-ca.test.api.gov.bc.ca
export GATEWAY_SERVICE_NAME=soba-proxy-proof-soba-dev
export BACKEND_HOST=soba-dev-backend.your-namespace.svc
node deployments/gateway/scripts/generate-gateway-config.mjs \
  --format kong --output /tmp/gateway-kong.yaml
```

The generator only renders configuration; it does not log in or publish. The
workflow sets explicit names as shown above. When using the generator's optional
`PR_NUMBER` shorthand, its default service name is `soba-pr-<number>-dev`, which
differs from the workflow's proof name. Supply `GATEWAY_SERVICE_NAME` explicitly
to reproduce the workflow.

The default `--format resource` emits a `GatewayService` for inspection. Use
`--format kong` with `gwa publish-gateway --qualifier "$GATEWAY_QUALIFIER"`;
do not use unqualified `gwa apply` for this shared-gateway proof.

## Persistence and cleanup

The proxy and NetworkPolicy remain while the PR is open. On close, the gateway
cleanup job uses the `pr` GitHub environment and its publishing credentials to
synchronize `services: []` with the exact `proxy-proof-soba-pr-<number>` qualifier.
It performs a dry-run first, then publishes and polls until the matching Service
is absent. It never destroys the shared gateway or publishes without a qualifier.
Empty qualified synchronization must be accepted by APS; failures are reported by
the job rather than treated as successful cleanup.

The cleanup job runs alongside OpenShift teardown, so an APS failure does not
prevent removal of the application and databases. The existing release-label
sweep removes the PR NetworkPolicy. Close events no longer have a changed-path
filter. To retry missed or failed cleanup, manually run **PR Close** with the PR
number. Keep `APS_PR_ENABLED=true` until outstanding PR gateway resources are
removed; setting it to false skips both automatic publishing and gateway cleanup.
There is no scheduled reconciliation yet.

The NetworkPolicy is applied directly; Helm's saved values are not updated.
For permanent chart management, enable `gatewayNetworkPolicy` with the confirmed
namespace labels in the release values. Stable dev/test proof resources are not
removed by PR Close.

## Troubleshooting

- **Gateway job skipped:** verify the repository variable `APS_PR_ENABLED` is
  exactly `true` and the PR deployment succeeded.
- **Validation failed:** check the release name, `OC_NAMESPACE`, the 64-character
  checksum, gateway ID, and hostname. Some shell validation checks currently
  exit with code 1 without naming the invalid setting.
- **Login failed:** check credentials for the automatically selected APS test or
  production instance and the publishing account permission.
- **Gateway status or `/health` failed:** inspect namespace labels, backend ready
  endpoints, gateway cluster placement, and inherited gateway plugins. The workflow
  requires both the expected service to be `UP` and the health response to pass.

Direct OpenShift Route success does not prove that APS can reach the internal
Service. A successful check writes the gateway health URL and internal upstream
mapping to the workflow summary; until that check passes, connectivity is unverified.
