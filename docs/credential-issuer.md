# Credential issuer

Backend code issues and regenerates gateway API keys through a dedicated registry, following
the tenant and document-generation integrations:

```ts
import { createDefaultCredentialIssuerAdapter } from '../core/integrations/credential-issuer/CredentialIssuerRegistry';

const issuer = createDefaultCredentialIssuerAdapter();
const credential = await issuer.issue({
  applicationName: 'workspace-integration',
  labels: { 'issued-by': 'soba' },
  aclGroups: ['workspace-group'],
});
// Return credential.apiKey once; never log or persist it.
// Rotate with issuer.regenerate(credential.clientId).
```

The feature calling this adapter must authorize administrators, reserve the workspace's credential
slot before issuing, persist consumer ownership, and reconcile uncertain outcomes. This integration
adds no routes, database records, or incoming API-key authentication. ACL groups only apply to the
`kong-api-key-acl` flow. Labels are administrative metadata, not authorization.

## Configuration

`CREDENTIAL_ISSUER_DEFAULT_CODE` defaults to `credential-issuer-noop`. The no-op needs no config
and throws `ServiceUnavailableError` on both operations; its readiness reports unavailable.
Select `aps-credential-issuer-v3` to use the APS Directory API. Configure via `PluginConfigReader`:

| Setting | Purpose |
| --- | --- |
| `PLUGIN_APS_CREDENTIAL_ISSUER_V3_API_BASE_URL` | Directory API base URL including `/ds/api/v3` |
| `PLUGIN_APS_CREDENTIAL_ISSUER_V3_GATEWAY_ID` | Issuer's gateway |
| `PLUGIN_APS_CREDENTIAL_ISSUER_V3_ENVIRONMENT_APP_ID` | Product environment's appId, not the product appId |
| `PLUGIN_APS_CREDENTIAL_ISSUER_V3_TOKEN_URL` | OAuth service-account token endpoint |
| `PLUGIN_APS_CREDENTIAL_ISSUER_V3_CLIENT_ID` | Issuer service-account ID |
| `PLUGIN_APS_CREDENTIAL_ISSUER_V3_CLIENT_SECRET` | Issuer service-account secret |
| `PLUGIN_APS_CREDENTIAL_ISSUER_V3_TIMEOUT_MS` | Optional operation deadline including token acquisition and one 401 retry |

The account needs `CredentialIssuer.Generate` on the configured gateway. Environment discovery
requires `Namespace.Manage`; perform it during setup rather than granting it to the runtime issuer.
OAuth scopes, when required, must currently be supplied by the service account's default scopes.

In Helm, set `backend.config.credentialIssuerDefaultCode` and `backend.credentialIssuer.apsCredentialIssuerV3`.
Defaults leave every environment on the no-op. Vault injects `PLUGIN_APS_CREDENTIAL_ISSUER_V3_CLIENT_ID` and
`PLUGIN_APS_CREDENTIAL_ISSUER_V3_CLIENT_SECRET` only when APS is selected. Without Vault, supply these keys through
an existing deployment secret/environment mechanism; do not put them in ConfigMaps or values files.

## Operations and health

Issue calls `POST /gateways/{gatewayId}/consumers`; regeneration calls
`PUT /gateways/{gatewayId}/consumers/{clientId}?action=regenerate`. Only API-key flows are accepted.
There is no delete, disable, or revoke operation. Revocation is manual in the gateway portal.

Token acquisition is cached through the shared OAuth provider. An explicit 401 clears the cache
and permits one retry within the same operation deadline. Timeouts and other failures are not
retried: the gateway may already have created or rotated the credential. A malformed success
response likewise needs reconciliation before another issuance attempt.

`/meta/plugins` marks the selected issuer. Startup and `/health/ready` report all installed issuers,
like tenant engines, without affecting readiness HTTP status. APS readiness obtains a token only;
it does not prove Directory API reachability or gateway issuance permission. No credentials are
issued by health checks. Upstream response bodies and raw errors are not exposed by this adapter.
