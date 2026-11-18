# Integration API v2

Mounted at `${API_BASE_PATH}/api/integrations/v2`. The OpenAPI document is served at
`/openapi.json`; it documents implemented endpoints only. The existing internal API's credential
OpenAPI contracts include `permissions` and `availablePermissions`.

`v2/schema.ts` defines named schemas and registers operations; `v2/openapi.ts` builds the separate
document using the shared backend OpenAPI builder. Common liveness/error schemas and rate-limit
documentation are reused. Explicit gateway error bodies remain distinct from backend errors.

## Credential grants

Migration `0072_credential_permissions.sql` adds explicit per-key permissions; existing keys
receive none. `submission_read` is the initial supported permission. Creating or editing grants
requires holding those permissions on the credential's workspace or form in addition to existing
key-management authorization. A web-component-only credential cannot hold API grants.

Workspace grants are an upper bound; form overrides must still be respected at request time.
The creator's current access must also bound each future resource request. Credential lookup
alone is authentication, not resource authorization.

## Submission export

`GET /forms/{formId}/submissions/export?format=json` exports submitted, non-deleted submissions;
use `format=csv` for CSV (JSON is the default). Optional filters are `formVersionId`, `from` and
`to` (ISO timestamps, inclusive lower and exclusive upper bound, capped at now).
The endpoint reuses the designer export serializers, including CSV formula escaping.
It requires the `submission-export` feature to be enabled (otherwise 404), checked after
authorization before each database page and before returning the file. It checks the active key's
`submission_read` grant, workspace/optional form scope and the creator's
current form permissions (including overrides), before each database page and again before sending.
Responses are buffered up to 10 MiB. A 60-second export deadline starts before the initial
permission checks, after gateway authentication. It bounds waiting for database queries, schema
loading and serialization; client disconnects abort the reader. Dependencies that do not support
cancellation may finish in the background, but no later page is started or late response sent. Missing engine documents fail the
request rather than returning an incomplete export. CSV also returns 503 if an exported row’s
version schema is unavailable; schemas from other versions are never used as a fallback. JSON
can still return the submission answers without that schema. Narrow the date range for larger exports.

Local gateway examples (create/approve the key in the local database):

```bash
curl --fail-with-body -H "X-API-KEY: $API_KEY" \
  "https://soba-dev.api.gov.bc.ca/local/integrations/v2/forms/$FORM_ID/submissions/export?format=json" \
  -o submissions.json
curl --fail-with-body -H "X-API-KEY: $API_KEY" \
  "https://soba-dev.api.gov.bc.ca/local/integrations/v2/forms/$FORM_ID/submissions/export?format=csv" \
  -o submissions.csv
```

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


## Authentication and export regression tests

Run `pnpm --filter @soba/backend exec jest --runInBand tests/integration/v2`.
`exportSecurity.test.ts` uses the production `createApp()` middleware stack and keeps JWT verification,
credential middleware, permission checks, export paging and JSON/CSV serialization real.
Only JWKS transport, repositories and engine data are mocked. An explicit inventory checks every
registered and documented method/path and its public/API-key security policy. New operations need
an inventory entry and authentication regressions, including non-GET operations. Test fixtures live
in `tests/integration/fixtures`: complete typed records, signing keys, and application environment
settings pinned before middleware initialization. Mock declarations remain local to each suite.
Suites group identity, HTTP behavior, permissions, deadlines, schema integrity and cleanup separately.
Tests cover application request tracing/rate-limit headers, separation from staff authentication,
forged identity headers, invalid audience, missing local credentials, scope boundaries,
permission/grant loss and revocation between pages, feature changes, stalled dependencies and
client disconnects. Resolver mocks do not replace database-backed tests of membership/override SQL,
and these tests do not require a database, APS access or a separate CI job. Server listening,
startup diagnostics and background workers stay in `app.ts` and are not started by the tests.
