# Integration API v2

Mounted at `${API_BASE_PATH}/api/integrations/v2`. The OpenAPI document is served at
`/openapi.json`; it documents implemented endpoints only. The existing internal API's credential
OpenAPI contracts include `permissions` and `availablePermissions`.

`v2/schema.ts` defines named schemas and registers operations; `v2/openapi.ts` builds the separate
document using the shared backend OpenAPI builder. Common liveness/error schemas and rate-limit
documentation are reused. Explicit gateway error bodies remain distinct from backend errors.

## Credential grants

Migration `0070_credential_permissions.sql` adds explicit per-key permissions; existing keys
receive none. `submission_read` is the initial supported permission. Creating or editing grants
requires holding those permissions on the credential's workspace or form in addition to existing
key-management authorization. A web-component-only credential cannot hold API grants.

Workspace grants are an upper bound; form overrides must still be respected at request time.
The creator's current access must also bound each future resource request. Credential lookup
alone is authentication, not resource authorization. Export routes are not enabled yet.

## Gateway identity

The gateway validates `X-API-KEY` and the Product Environment ACL, then adds a signed `GW-JWT`
using `kong-upstream-jwt` (`include_credential_type: false`). Clients still send only their API key.
The backend verifies the signature using cached configured JWKS keys, RS256, exact issuer and
service audience, expiration and a maximum token age of two minutes (five seconds clock tolerance).
Both `iat` and `exp` are required. Token-supplied certificate chains and JWKS URLs are not trusted.
JWKS resolution is shared with staff SSO in `core/auth/jwks.ts`; gateway identity checks remain
in integration middleware. Configuration is parsed through `core/config/env.ts`.

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
`/health` and `/openapi.json` remain public at the backend (gateway policies may be stricter).
When `/health` receives `GW-JWT`, it verifies the token and returns `gatewayAuthenticated: true`;
an invalid supplied token is rejected. PR gateway smoke checks require this field so a passing
probe proves JWT verification, not just liveness. Health does not resolve a credential or check
resource permissions; a shared CI API key can therefore test each PR's gateway hop.

The earlier shared-secret proof is no longer accepted. `GW-JWT` is redacted from both logs and
the `/me` response. See `deployments/gateway/README.md` for the protected gateway template.
