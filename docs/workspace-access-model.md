# Workspace access model

How access works for **internal workspaces** — the ones created inside SOBA (`kind = 'team'`, via
`POST /workspaces`). Enterprise/CSTAR tenant workspaces are provisioned differently; see
[CSTAR tenants](#cstar-tenants) at the end.

Two separate things control access:

- **Workspace management** — can you administer the workspace itself (rename it, manage members and
  groups)? This is a single coarse role on your membership.
- **Form access (RBAC)** — what can you do with the forms in the workspace? This comes from group
  membership → roles → permissions.

They don't overlap: being a workspace admin grants no form permissions, and vice versa. Submit mode
adds a third control per submission, who takes part in it; see
[Submission participants](#submission-participants).

> **Current status.** The design form routes (`api/forms/route.ts`) and the staff submission routes
> (`api/submissions/route.ts`) are gated by `requireFormPermissions`, except schema normalize (no
> workspace). Creating a form requires `form_create` and `design_create` — only `form_admin` satisfies
> that, via `*`. Creating a design on an existing form requires `design_create` (`form_designer`). The
> submit routes, file uploads and document generation are gated by `isSubmitterAllowed` (see
> [Submission participants](#submission-participants)); rendering a document also needs
> `document_template_read`. The template routes (`features/templates/route.ts`) are gated by
> `requireFormPermissions`: `document_template_read` to list and download, `document_template_create`
> to upload, replace and rename, `document_template_delete` to delete. Only `form_admin` (via `*`)
> holds the create and delete codes; `form_submitter` holds read. A draft created from an existing
> version gets that version's templates under `design_create` alone. Group and member management is
> gated by workspace role (`requireWorkspaceManage`), not by RBAC.

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

| method   | path                                                | effect                                                              |
| -------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `GET`    | `/workspaces/:id/groups`                            | list active groups with their roles and `user` members (any member) |
| `POST`   | `/workspaces/:id/groups`                            | create a group carrying `roleCodes`                                 |
| `PATCH`  | `/workspaces/:id/groups/:groupId`                   | rename / re-describe a group                                        |
| `DELETE` | `/workspaces/:id/groups/:groupId`                   | soft-delete a group                                                 |
| `PUT`    | `/workspaces/:id/groups/:groupId/roles`             | replace a group's role set                                          |
| `POST`   | `/workspaces/:id/groups/:groupId/members`           | add a workspace member (by `membershipId`)                          |
| `DELETE` | `/workspaces/:id/groups/:groupId/members/:memberId` | remove a member by its row id                                       |

Group names are unique among **active** groups in a workspace. Delete is a soft-delete: the group and
its roles and memberships are set to `inactive` in one transaction, so the resolver (which only reads
active roles/memberships) stops granting through it, and the name frees up for reuse.

Only `user` members are managed here. Per-form overrides are covered in
[Form-level overrides](#form-level-overrides). The repo (`workspaceGroupRepo.ts`) is shared with
workspace bootstrap.

**Protected groups.** The two bootstrap groups carry a hidden `workspace_group.system_code`
(`form_admins`/`form_submitters`) so protections don't depend on the renameable name. Both can be
renamed but not deleted, and their roles can't be changed; _Form administrators_ must always keep at
least one active user member (the last member can't be removed). Attempts return 409. The group DTO
exposes a `system` boolean so the UI can hide those actions.

**Members are people.** Each member is `{id, kind:'user', membershipId, userId, displayLabel}`, added
via `POST /workspaces/:id/groups/:groupId/members` with `{kind:'user', membershipId}` and removed by
row id. Who outside the workspace may submit is not group membership; it is the
[Form Audience](#form-audience) setting.

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
```

- `workspace_group` — a named group in a workspace.
- `workspace_group_role` — the role(s) a group carries (many-to-many; a group can hold more than one).
- `workspace_group_membership` — who is in a group.
- `role` / `permission` / `role_permission` — the catalog: the roles, the permissions, and the mapping
  between them.

### The catalog

Six form roles are seeded (`role` + `role_permission`):

| role                  | permissions                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `form_admin`          | `*` (everything)                                                                                           |
| `form_designer`       | `form_read`, `design_create`, `design_read`, `design_update`, `design_delete`                              |
| `form_submitter`      | `form_read`, `submission_create`, `document_template_read`                                                 |
| `submission_reviewer` | `form_read`, `submission_read`, `submission_update`, `submission_delete`, `submission_review`, `team_read` |
| `submission_approver` | `form_read`, `submission_read`, `submission_review`, `team_read`                                           |
| `team_manager`        | `form_read`, `team_read`, `team_update`                                                                    |

`*` is a wildcard: a role holding it satisfies any permission check. Only `form_admin` has it, so adding
new permissions later needs no change to that role.

`form_create` is catalogued but not assigned to any seeded role. Only `form_admin` can create a form
(via `*`). `form_designer` can create a new design on an existing form (`design_create`).

The permission codes are: `form_create/read/update/delete`, `design_create/read/update/delete`,
`submission_create/read/update/delete/review`, `team_read/update`, `document_template_create/read/delete`.

### Group membership is "who", not "what"

A `workspace_group_membership` row records _which_ people are in a group, never their role. The role
lives on the group (`workspace_group_role`). A member is `member_kind = user`, referencing a
`workspace_membership_id`. The table also allows `idp` and `idp_group` kinds, which nothing writes or
reads.

`user` members are resolved for form permissions by `resolveFormPermissions`.

### The special groups

Creating a workspace bootstraps two form groups (`bootstrapWorkspaceOwner` in `workspaceRepo.ts`):

| group               | role             | members on create     |
| ------------------- | ---------------- | --------------------- |
| Form administrators | `form_admin`     | the workspace creator |
| Form submitters     | `form_submitter` | none                  |

So the creator can do everything with the workspace's forms. Form submitters holds the people given
the submit role.

### Form-level overrides

A form can override a workspace group's membership for itself. A new form overrides nothing and
inherits every group, so a change to a workspace group reaches every form that has not overridden it.

- `form_group_override` - one active row per (form, group) marks an explicit override.
- `form_group_override_member` - the override's members, with the same `member_kind` references and
  constraints as `workspace_group_membership`.

An override replaces the group's whole membership for that form; roles stay on the workspace group.
Returning to inherit sets the override `inactive` and deletes its members.
`effectiveGroupMembers` in `formGroupOverrideRepo.ts` returns, for a form, each active group's override
members where the form has an active override, otherwise the workspace group's members.

No API writes overrides yet.

The submit surface reads overrides: `hasFormSubmitAccess({workspaceId, formId}, ...)` resolves roles
with `resolveFormPermissionsForForm`, which follows the form's effective `user` members, and then checks
the form's [audience](#form-audience). Submit mode uses it to open a submission, alongside
participation to save, submit, upload and delete a file on an in-progress submission, and on its own
(`submission_update`) to delete a file on a submitted submission. Design routes and lists still use
`resolveFormPermissions`, which reads workspace group membership, so they are not form-aware yet.

### Form Audience

Who outside the workspace may submit is a shared settings group (see [Form settings](form-settings.md)):

- `workspace_audience_setting` - one row per workspace, created with it: `mode` and `idps`.
- `form_audience_setting` - one row per form, created with it: `inherit`, and the form's own `mode`
  and `idps` while it does not inherit.

| mode        | admits                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| `public`    | everyone, including anonymous callers                                     |
| `protected` | callers signed in through one of `idps`, which are active login providers |
| `members`   | no one beyond role holders                                                |

A form that inherits uses its workspace's audience, read when asked, so a workspace change reaches it
with nothing copied. A form may be more open than its workspace. Anyone a group gives
`submission_create` can submit whatever the audience. A new workspace is `protected` by
`DEFAULT_SUBMITTER_PROVIDER` (`azureidir` when unset) when that is an active login provider, otherwise
`members`. Anonymous callers carry the `public` pseudo provider (`is_login_provider = false`), which
no audience lists.

| method        | path                                                 | effect                                                                                                                                                       |
| ------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET` / `PUT` | `/workspaces/:id/settings/audience`                  | reads and saves `{values: {mode, idps}, version}`; any member reads, owner/admin writes                                                                      |
| `GET`         | `/workspaces/:id/settings/audience/inheriting-forms` | `{count}` of live forms that use the workspace's audience; any member                                                                                        |
| `GET` / `PUT` | `/design/forms/:id/settings/audience`                | reads `{inherit, own, workspace, effective, version}`; saves `{inherit: true, version}` or `{inherit: false, values, version}` (`form_read` / `form_update`) |

A save names the `version` it read; a save from an older one gets a 409 and changes nothing. A new
form can start with its own audience from `settings.audience` in the create body.

`hasFormSubmitAccess` and `isPublicAudience` in `formSubmitAccessRepo.ts` read the form's effective
audience through `findEffectiveAudience`. Drafts are not offered on a public audience.

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
it reads workspace group membership and not form overrides. `hasAllPermissions(perms, required)` does
the check and treats `*` as a match for anything.

`GET /forms/:id` returns the caller's resolved codes as `permissions` (a sorted array, `['*']` for
admins) so the UI can gate actions. This reads the same resolver, so it upgrades automatically when
per-form resolution lands.

## Submission participants

Once a submission exists, reading it in submit mode needs an active grant on it, and changing it
needs a form permission. `submission_participant` holds one row per grant: `user_id`, `role` (`owner`
or `collaborator`), `status` (`active` or `inactive`), `granted_by`, and `revoked_by`/`revoked_at`. A
grant is revoked, never deleted, so the rows are the access history. Opening a submission makes the
opener its owner. The shared public user owns anonymous submissions, so any anonymous caller holding
the id has access to those.

`isSubmitterAllowed` in `services/submitterAccess.ts` holds the rules:

| operation                                                                 | needs                                                    |
| ------------------------------------------------------------------------- | -------------------------------------------------------- |
| `open`                                                                    | `submission_create` on the form (`hasFormSubmitAccess`)  |
| `read`: confirmation, data, schema, fill, file download                   | an active grant                                          |
| `write`: save, submit, upload, delete a file on an in-progress submission | an active grant and `submission_create` on the form      |
| `deleteSubmittedFile`                                                     | `submission_update` on the form                          |
| `render`: print, preview, template list                                   | an active grant and `document_template_read` on the form |
| `delete`: the caller's own submission                                     | a signed-in caller with an active owner grant            |

Owners and collaborators have the same access, except that only an owner deletes. A submitter
deletes only an opened or draft submission; a submitted one is a 409. The public user's ownership
grants no delete, because every anonymous caller shares it. Design routes do not use these rules;
staff read and delete submissions through form permissions. Files, print and preview have no design
route, so staff download files through `/files` or `/submit/files`, and print and preview through
the submit routes, all of which need a grant.

`GET /submit/submissions/mine` lists the draft and submitted submissions the caller holds an active
grant on, across every workspace, with the caller's role on each. Submissions on a deleted form or
form version are left out. Anonymous callers get a 401, since the public user's grants are shared.

## What a new workspace looks like

Creating a workspace writes, in one transaction:

- 1 `workspace` (`kind = 'team'`)
- 1 `workspace_membership` for the creator (`role = 'owner'`)
- 2 `workspace_group` — "Form administrators", "Form submitters"
- 2 `workspace_group_role` — those groups' `form_admin` / `form_submitter` roles
- 1 `workspace_group_membership` - the creator in "Form administrators"
- 1 row per shared settings group, such as `workspace_audience_setting`

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
