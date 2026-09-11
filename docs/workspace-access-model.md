# Workspace access model

How access works for **internal workspaces** — the ones created inside SOBA (`kind = 'team'`, via
`POST /workspaces`). Enterprise/CSTAR tenant workspaces are provisioned differently; see
[CSTAR tenants](#cstar-tenants) at the end.

Two separate things control access:

- **Workspace management** — can you administer the workspace itself (rename it, manage members and
  groups)? This is a single coarse role on your membership.
- **Form access (RBAC)** — what can you do with the forms in the workspace? This comes from group
  membership → roles → permissions.

They don't overlap: being a workspace admin grants no form permissions, and vice versa.

> **Current status.** The RBAC tables, the permission resolver, and the per-workspace groups all exist,
> but enforcement is **not wired into the routes yet**. Right now any active workspace member can still
> perform any form operation. The middleware that gates on permissions (`requireFormPermissions`) is
> written but applied to no routes — it gets wired in with the form-visibility rework.

```
                        User in a workspace
                                 |
       workspace_membership.role |  group membership
            +--------------------+--------------------+
            |                                         |
            v                                         v
   +--------------------+                 +----------------------------+
   | Workspace mgmt     |    no overlap   | Form access (RBAC)         |
   | rename, members,   | <----- X -----> | read/edit/publish forms,   |
   | groups             |                 | submissions                |
   +--------------------+                 +----------------------------+
```

## Workspace management

`workspace_membership` is the roster: one row per (user, workspace) with a coarse `role` of `owner`,
`admin`, `member`, or `viewer`. `owner`/`admin` may administer the workspace, checked with
`isWorkspaceManageRole(role)` straight off the membership row (e.g. `updateWorkspaceName` in
`workspaceRepo.ts`, mirrored on the frontend in `workspaceRoles.ts`).

That role is the only source of workspace-management authority. It's never read for form permissions.

### Managing groups and members

Groups, their roles, and their members are managed through the group APIs, gated by
`requireWorkspaceManage` (owner/admin only, via `req.coreContext.role`):

| method | path | effect |
|--------|------|--------|
| `GET`    | `/workspaces/:id/groups` | list active groups with their roles and `user` members (any member) |
| `POST`   | `/workspaces/:id/groups` | create a group carrying `roleCodes` |
| `PATCH`  | `/workspaces/:id/groups/:groupId` | rename / re-describe a group |
| `DELETE` | `/workspaces/:id/groups/:groupId` | soft-delete a group |
| `PUT`    | `/workspaces/:id/groups/:groupId/roles` | replace a group's role set |
| `POST`   | `/workspaces/:id/groups/:groupId/members` | add a workspace member (by `membershipId`) |
| `DELETE` | `/workspaces/:id/groups/:groupId/members/:membershipId` | remove a member |

Group names are unique among **active** groups in a workspace. Delete is a soft-delete: the group and
its roles and memberships are set to `inactive` in one transaction, so the resolver (which only reads
active roles/memberships) stops granting through it, and the name frees up for reuse.

Only `user` members are managed here; `idp`/`idp_group` members and per-form overrides are a later
phase. The repo (`workspaceGroupRepo.ts`) is shared with workspace bootstrap.

**Protected groups.** The two bootstrap groups carry a hidden `workspace_group.system_code`
(`form_admins`/`form_submitters`) so protections don't depend on the renameable name. Both can be
renamed but not deleted, and their roles can't be changed; *Form administrators* must always keep at
least one active user member (the last member can't be removed). Attempts return 409. The group DTO
exposes a `system` boolean so the UI can hide those actions.

**Members are typed.** Each member is `{id, kind:'user', …}` or `{id, kind:'idp', code, label}`, added
via `POST …/members` with `{kind:'user', membershipId}` or `{kind:'idp', code}` and removed by row id.
Only *Form submitters* accepts `idp` members (all other groups are user-only); an `idp` must be an active
login provider or `public`, never `system`. `public` is exclusive — it can only be the group's sole
member (blocks all other adds, and can't be added to a non-empty group). This is the workspace-level
submit audience; enforcement (retiring `form_version.visibility`) is a later stage.

## Form access (RBAC)

Form permissions come from **groups**. A workspace has groups, each group carries one or more roles, and
each role grants permissions. Users are members of groups.

```
   workspace
      |
      +-- has --> workspace_group
                     |
                     +-- carries --> workspace_group_role --> role
                     |                                          |
                     |                          grants (role_permission)
                     |                                          v
                     |                                       permission
                     |
                     +-- contains --> workspace_group_membership
                                          |
                                          +  member_kind = user      --> workspace_membership
                                          +  member_kind = idp        --> identity_provider
                                          +  member_kind = idp_group   --> idp_group
```

- `workspace_group` — a named group in a workspace.
- `workspace_group_role` — the role(s) a group carries (many-to-many; a group can hold more than one).
- `workspace_group_membership` — who is in a group.
- `role` / `permission` / `role_permission` — the catalog: the roles, the permissions, and the mapping
  between them.

### The catalog

Five form roles are seeded (`role` + `role_permission`):

| role                  | permissions |
|-----------------------|-------------|
| `form_admin`          | `*` (everything) |
| `form_designer`       | `form_read`, `design_create`, `design_read`, `design_update`, `design_delete` |
| `form_submitter`      | `form_read`, `submission_create` |
| `submission_reviewer` | `form_read`, `submission_read`, `submission_update`, `submission_delete`, `submission_review` |
| `submission_approver` | `form_read`, `submission_read`, `submission_review`, `team_read` |

`*` is a wildcard: a role holding it satisfies any permission check. Only `form_admin` has it, so adding
new permissions later needs no change to that role.

The permission codes are: `form_read/update/delete`, `design_create/read/update/delete`,
`submission_create/read/update/delete/review`, `team_read/update`.

### Group membership is "who", not "what"

A `workspace_group_membership` row records *which* users/identities are in a group — never their role.
The role lives on the group (`workspace_group_role`). `member_kind` selects the reference:

| `member_kind` | reference | means |
|---------------|-----------|-------|
| `user`        | `workspace_membership_id`  | a specific workspace member |
| `idp`         | `identity_provider_code`   | anyone signing in through that provider (e.g. `azureidir`) |
| `idp_group`   | `idp_group_code`           | anyone whose provider is in that IdP group (e.g. `bcgov` = `idir` + `azureidir`) |

Only `user` members are resolved today. `idp` and `idp_group` exist for the upcoming form-visibility
work; they're how "any IDIR user" or "public" will get submit access without naming individuals.
`public` is a pseudo identity provider (`identity_provider.is_login_provider = false`) used as a
match-all selector.

### The special groups

Creating a workspace bootstraps two form groups (`bootstrapWorkspaceOwner` in `workspaceRepo.ts`):

| group                | role             | members on create |
|----------------------|------------------|-------------------|
| Form administrators  | `form_admin`     | the workspace creator |
| Form submitters      | `form_submitter` | none (empty) |

So the creator can do everything with the workspace's forms. The Submitter group sits empty until
submitter access is configured; the visibility work fills it with `idp`/`public`/user members.

### Resolving a user's permissions

`resolveFormPermissions(actorId, workspaceId)` in `formAccessRepo.ts` returns the set of permission
codes a user holds:

```
   actorId + workspaceId
        |
        v
   workspace_group_membership     (member_kind = user, active)
        |
        v
   workspace_group_role
        |
        v
   role_permission
        |
        v
   permission set                 (may contain '*')
```

It's workspace-scoped: a user's form permissions are the same for every form in the workspace, because
there's no per-form override yet. `effectiveFormPermissions(actorId, formId)` is a thin wrapper that
looks up the form's workspace and calls the same function. `hasAllPermissions(perms, required)` does the
check and treats `*` as a match for anything.

`GET /forms/:id` returns the caller's resolved codes as `permissions` (a sorted array, `['*']` for
admins) so the UI can gate actions. This reads the same resolver, so it upgrades automatically when
per-form resolution lands.

## What a new workspace looks like

Creating a workspace writes, in one transaction:

- 1 `workspace` (`kind = 'team'`)
- 1 `workspace_membership` for the creator (`role = 'owner'`)
- 2 `workspace_group` — "Form administrators", "Form submitters"
- 2 `workspace_group_role` — those groups' `form_admin` / `form_submitter` roles
- 1 `workspace_group_membership` — the creator in "Form administrators" (the Submitter group starts empty)

## CSTAR tenants

Everything above is internal workspaces. Enterprise/CSTAR tenant workspaces (`kind = 'enterprise'`) are
meant to be provisioned from the CSTAR Tenant Management System and synced in — groups and role assignments
come from there. They land in the same `workspace` / `workspace_group` / `workspace_membership` tables, so
don't assume a row was created locally.

The `enterprise-cstar` resolver plugin and `enterprise_binding` repo were removed in 2026-07 (dormant:
`resolve()` was never called, workspace context is resolved per-route by `workspaceContext` now). The
binding/sync tables are kept for a future sync and are currently empty: `enterprise_workspace_binding`,
`enterprise_group_binding`, `enterprise_membership_binding`, `enterprise_sync_cursor`, `enterprise_sync_log`.

Notes for whoever builds the sync (checked against the CSTAR codebase):

- Pull only — no webhooks or events. A poller on our side fetches and reconciles.
- No `updated_since` or cursor params. Watermark client-side on each entity's `updatedDateTime` +
  `isDeleted`, stashed in `enterprise_sync_cursor.cursor_value`.
- CSTAR is group-centric: roles go Role → Group → User (`GroupSharedServiceRole`). Bind CSTAR `Group.id` to
  `workspace_group_id`; our group→role catalog does the rest.
- Identity: `provider_identity_subject` = CSTAR `SSOUser.ssoUserId`, `provider_identity_type` = `idpType`
  (`idir` / `bceidbusiness` / `azureidir`; no Basic BCeID).
- Auth to CSTAR as a registered shared service (JWT audience = our `clientIdentifier`).
- Nothing maps CSTAR `SharedServiceRole` → our role yet. Check whether group binding covers it or add a table.
