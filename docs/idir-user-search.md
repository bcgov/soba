# IDIR user search

The authenticated backend endpoint `GET /api/v1/identity-search/idir` accepts `email`,
`firstName`, `lastName`, and `guid`. A `workspaceId` and at least one non-empty filter are required. The caller must
have an active workspace `owner` or `admin` membership.
It returns `{ "users": [...] }`; malformed input returns 400 and unavailable CSS
returns 503. The backend forwards these filters with GET to
`<API_BASE_URL>/<ENVIRONMENT>/idir/users` using its CSS API account.

The frontend can import `searchIdirUsers` from
`frontend/src/features/identity-directory/data/api.ts` and call
`searchIdirUsers(token, { workspaceId: 'workspace-id', firstName: 'Alice', lastName: 'Smith' })`.
The form Team tab uses this client to search by email, first name, or last name and select a directory user. Selection does not grant access. The CSS adapter unwraps the upstream `{ "data": [...] }` response into Soba’s `{ "users": [...] }` response.

## Access and assignment limitations

Anonymous callers cannot search. Authenticated callers without an active workspace `owner` or `admin` membership
receive 403. Authorization uses the workspace membership role;
form-specific grants alone do not authorize this endpoint.

The workspace controls access, not the directory results. CSS can return IDIR users
who have never logged into Soba. Search does not create Soba accounts or memberships.
The existing group-permission assignment flow requires a Soba workspace membership,
so assigning access before a person's first login still requires additional implementation.

## Enable CSS

Set `USER_DIRECTORY_DEFAULT_CODE=css-v1` and configure:

- `PLUGIN_CSS_V1_API_BASE_URL`: CSS API URL including `/api/v1`.
- `PLUGIN_CSS_V1_ENVIRONMENT`: `dev`, `test`, or `prod`.
- `PLUGIN_CSS_V1_TOKEN_URL`: OAuth token endpoint.
- `PLUGIN_CSS_V1_CLIENT_ID` and `PLUGIN_CSS_V1_CLIENT_SECRET`: CSS API account credentials.
- `PLUGIN_CSS_V1_TIMEOUT_MS`: optional total request budget, including token exchange and retry.

Put local credentials in `backend/.env.local`. For Helm, use
`backend.config.userDirectoryDefaultCode`, configure `backend.userDirectory.cssV1`,
and point `existingSecretName` at a Kubernetes Secret containing the two credential
keys above. It works alongside Vault-backed deployment credentials.
The default directory is `css-v1`. Missing CSS configuration is reported by readiness;
authorized searches return 503.
Readiness reports the CSS token exchange, which does not verify directory API permissions.
The directory endpoint requires an active owner or admin membership in the supplied workspace.

CSS authentication reference: https://bcgov.github.io/sso-docs/css-application/css-app-api
