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
slot before issuing, persist consumer ownership, and reconcile uncertain outcomes. The plugin itself
adds no routes, database records, or incoming API-key authentication. The workspace service below
provides the management API and metadata persistence. ACL groups only apply to the
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

## Workspace credential API

Authenticated workspace owners and admins can use these endpoints, relative to the configured
API base (normally `/chefs/api/v1`):

| Method | Path                                                   | Response                                   |
| ------ | ------------------------------------------------------ | ------------------------------------------ |
| GET    | `/workspaces/:id/credentials`                          | `{ available, credential }`, metadata only |
| POST   | `/workspaces/:id/credentials`                          | 201 `{ credential, apiKey }`               |
| POST   | `/workspaces/:id/credentials/:credentialId/regenerate` | 200 `{ credential, apiKey }`               |

Both POST endpoints accept an empty JSON object (`{}`). Upstream configuration, consumer IDs,
labels and access groups cannot be supplied by the caller. The service constructs an application
name `soba-workspace-<workspace UUID>` and administrative workspace labels. It does not assign ACL
groups or implement incoming API-key authentication/authorization.

`available` means the selected issuer can be constructed from configuration; it does not perform
a live readiness or permission check. Metadata contains `id`, `status`, `createdAt`, `updatedAt`
and nullable `rotatedAt`. The response never exposes the upstream consumer ID or issuer settings.
All credential route responses use `Cache-Control: no-store`. Clients must keep returned keys
out of shared caches, persistent state, notifications and telemetry.

Run `pnpm --filter @soba/backend db:migrate` to apply migration `0055_workspace_credentials`.
There is one credential record per workspace. The service reserves that slot before issuance and
atomically reserves an active record before regeneration. The database stores metadata and
secret-free audit events only; API keys are never persisted. Existing credentials retain their
original issuer code even when the deployment default changes.

Statuses are `issuing`, `active`, `rotating`, and `unknown`. Any unsuccessful upstream operation
or failed completion is conservatively treated as an uncertain outcome. There is no automatic
retry or deletion of the reservation. A process crash can leave `issuing` or `rotating`; these
states also block further operations. If the browser loses a successful response, metadata shows
`active` but the secret cannot be retrieved; regenerate after checking the operation completed.

### Operator reconciliation

No reconciliation or deletion endpoint is exposed. An operator must check the APS consumer using
the deterministic application name and configured environment, confirm that no operation remains
in flight, and reconcile its identity with the workspace credential record. If a consumer exists,
record the confirmed consumer ID and flow and restore `active`; the owner can then regenerate to
obtain a new key. Only remove an unused reservation after confirming no consumer was created.
Record the reconciliation in `credential_audit` with the responsible actor. Do not blindly reset
`unknown` or pending records: a timeout may follow a successful creation or rotation.

Dev-data purge deletes credential audit rows before their workspace credential records. It removes
local metadata only; APS consumers must be revoked manually because the issuer has no revoke operation.


### Workspace settings UI

Workspace owners and admins can generate or regenerate a key from the workspace Settings tab.
Regeneration requires confirmation. The key is held only in local dialog state and cleared on
close, logout, user change, workspace change, or unmount; it never enters SWR, Redux, or browser
storage. Routine access-token refreshes preserve the open dialog. Metadata is cached separately.
The copy button writes to the user's clipboard only when pressed.

Migration `0056_credential_notes` adds optional notes. The UI's Done button saves these through
`PATCH /workspaces/:id/credentials/:credentialId` with `{ notes }` (maximum 1000 characters).
This endpoint is workspace owner/admin only and returns metadata, without the API key. Notes
must describe the storage location, not contain the key itself. Closing without Done discards
unsaved notes. A failed save keeps the key dialog open so the key can still be copied.
Metadata now includes `label` (the uppercase local credential UUID) and `notes`.

Learn more opens the supplied APS API-key documentation. Revoke opens
`https://api.gov.bc.ca/manager/consumers`; revocation remains an external action and does not
synchronize the local credential status automatically.

### API key dialog demo

Set `NEXT_PUBLIC_API_KEY_DEMO=true` in `frontend/.env.local` and restart the frontend.
The workspace settings flow returns `fake-api-key-test`, including regeneration and notes saving,
without calling credential endpoints or APS. Demo metadata and notes live only in component memory
and reset when leaving the workspace page. The section displays a translated demo notice.
Unset the flag and restart to restore live endpoint calls.
