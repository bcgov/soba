# Integration API v2

Served at `${API_BASE_PATH}/api/integrations/v2` by `createIntegrationApp()` on its own port,
`INTEGRATION_PORT` (default 4001). The Route and the router NetworkPolicy cover only the main API
port; from outside the release, only the APS NetworkPolicy admits this one.

The OpenAPI document documents implemented endpoints only. It is served at `/openapi.json` under
the integration base path (through the gateway, which requires an API key), and published without a
key at `${API_BASE_PATH}/api/docs/integrations/v2/openapi.json` on the main API port, where the
Swagger UI at `${API_BASE_PATH}/api/docs` offers it beside the backend API. Its server is
`INTEGRATION_API_PUBLIC_URL`, the gateway URL consumers call (Helm
`backend.integrationGateway.publicUrl`; PR deployments set it to their `/pr/<N>/integrations/v2`
route). Form and workspace settings show the same URL, the `X-API-KEY` header and a link to this
spec with API keys. Unset, the spec's server is the backend path, which resolves only on the
integration port, and settings show nothing. The docs page
is reference only: Try it out cannot reach the gateway from the browser.

`v2/schema.ts` defines named schemas and registers operations; `v2/openapi.ts` builds the separate
document using the shared backend OpenAPI builder. Common liveness/error schemas and rate-limit
documentation are reused. Explicit gateway error bodies remain distinct from backend errors.

## Gateway identity

The gateway validates `X-API-KEY` and the Product Environment ACL, then adds a signed `GW-JWT`
using `kong-upstream-jwt` (`include_credential_type: false`). Clients still send only their API key.
The backend verifies the signature using cached configured JWKS keys, RS256, exact issuer and
service audience, expiration and a maximum token age of two minutes (five seconds clock tolerance).
Both `iat` and `exp` are required. Token-supplied certificate chains and JWKS URLs are not trusted.
JWKS resolution and signature verification live in `core/auth/jwks.ts`; gateway identity checks
remain in integration middleware. Configuration is parsed through `core/config/env.ts`.

Configure the backend using the APS instance serving the gateway, rather than the SOBA app's
environment name. Gold may serve SOBA dev/PR releases using the production APS instance.

| APS instance    | Issuer                                                           | JWKS URI                                                               |
| --------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Production/Gold | `https://aps-jwks-upstream-jwt.api.gov.bc.ca`                    | `https://aps-jwks-upstream-jwt.api.gov.bc.ca/certs`                    |
| Test/Training   | `https://aps-jwks-upstream-jwt-api-gov-bc-ca.test.api.gov.bc.ca` | `https://aps-jwks-upstream-jwt-api-gov-bc-ca.test.api.gov.bc.ca/certs` |

The production values are published at
`https://aps-jwks-upstream-jwt.api.gov.bc.ca/.well-known/openid-configuration`.
See the [APS upstream JWT guide](https://github.com/bcgov/aps-infra-platform/blob/test/documentation/reference/plugins/kong-upstream-jwt.md).

```dotenv
INTEGRATION_GATEWAY_ISSUER=https://aps-jwks-upstream-jwt.api.gov.bc.ca
INTEGRATION_GATEWAY_JWKS_URI=https://aps-jwks-upstream-jwt.api.gov.bc.ca/certs
INTEGRATION_GATEWAY_AUDIENCE=<exact-Kong-integration-service-name>
INTEGRATION_GATEWAY_CLIENT_ID_CLAIM=consumername
```

Lookup uses the signed `consumername` claim by default, not unsigned `X-Consumer-*` headers.
Confirm that it equals the stored APS `clientId` with a real issued credential. If your deployment
stores Kong's internal ID instead, explicitly select `consumerid`. There is no fallback between
claims. These are the two claims documented by the upstream plugin; the mapping remains a live
integration check. NetworkPolicy and protected transport remain necessary for the gateway hop.

`GET /me` requires a valid gateway JWT and an active API credential from the configured issuer;
it returns only credential metadata and redacted request details. No raw API key is stored.
Missing gateway configuration fails closed with 503. Invalid JWT or credential returns 401.
`/health` and `/openapi.json` need no credential at the backend; the gateway requires an API key,
so the spec declares the key on every operation.
When `/health` receives `GW-JWT`, it verifies the token and returns `gatewayAuthenticated: true`;
an invalid supplied token is rejected. PR gateway smoke checks require this field so a passing
probe proves JWT verification, not just liveness. Health does not resolve a credential or check
resource permissions; a shared CI API key can therefore test each PR's gateway hop.

Only `GW-JWT` is accepted as gateway proof. It is redacted from both logs and the `/me` response. See `deployments/gateway/README.md` for the protected gateway template.

## Authentication regression tests

Run `pnpm --filter @soba/backend exec jest --runInBand tests/integration/v2`.
`security.test.ts` uses the production `createIntegrationApp()` and `createApp()` stacks and keeps
JWT verification and credential middleware real. Only JWKS transport, the credential repository and
the default credential issuer lookup are mocked. An explicit inventory checks every registered and
documented method/path, the API key the spec declares on it, and whether the backend itself requires
the gateway JWT. New operations need an inventory
entry and authentication regressions, including non-GET operations. Test fixtures live in
`tests/integration/fixtures`: complete typed records, signing keys, and application environment
settings pinned before middleware initialization. Mock declarations remain local to each suite.
Tests cover application request tracing/rate-limit headers, separation from staff authentication,
each app serving only its own routes, forged identity headers, invalid audience and missing local
credentials. They do not require a database, APS access or a separate CI job. Server listening,
startup diagnostics and background workers stay in `app.ts` and are not started by the tests.
