# Form settings

A form's settings live in self-contained groups. Each group owns its table, API, schemas and
Settings tab section. The forms route, controller, service and schema files do not reference them.

To add a group, follow [How to add a form settings group](how-to-add-form-settings.md); this page is
the reference for what the pieces are.

## Backend: `backend/src/features/form-settings/`

| file             | role                                                                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`       | `FormSettingsModule`: `key`, `weight`, optional `featureCode`, `router()`, `registerOpenApi`, `tables`, `createForForm`, and optional `workspace` (`router()`, `createForWorkspace`)                                               |
| `routes.ts`      | `settingsRoutes(service, bodySchema, scope)`: GET and PUT. A form group needs `form_read` and `form_update`; a workspace level is readable by members and writable by owners and admins. The permission is checked before the body |
| `schema.ts`      | `registerSettingsPaths`: the standard OpenAPI entries for a group at one scope; `inheritableOpenApiSchemas` and `registerInheritableSettingsPaths` for a shared group at both                                                      |
| `router.ts`      | mounts every module at `/design/forms/:id/settings/<key>` and every workspace level at `/workspaces/:id/settings/<key>`, after resolving the form or workspace and checking the module's feature (404 when unavailable)            |
| `create.ts`      | `createFormSettings` and `createWorkspaceSettings`: every group's row for a new form or workspace                                                                                                                                  |
| `inheritable.ts` | `toInheritableSettings`: a form's view of a shared group, from its row and the workspace's values                                                                                                                                  |
| `registry.ts`    | the list of modules, lowest `weight` first                                                                                                                                                                                         |
| `<group>/`       | `repo.ts`, `service.ts`, `openapi.ts`, `index.ts` (the module descriptor), plus any helper other features read the group through                                                                                                   |

Rows: every form has a row in every group. `FormService.create` calls each module's
`createForForm` in the transaction that creates the form, and each group's migration backfills a
row for every live form. The row takes its values from the column defaults, so defaults exist only
in the database. The one exception is a new workspace's audience: protected by the
`DEFAULT_SUBMITTER_PROVIDER` login provider, or members only when that provider is not an active
login provider. A read or save of a missing row is a 404. Other features read a group through its
service.

Versions: every settings row has a `version` that moves on with each save. A read returns it and a
save names it; a save from an older version gets a 409 and changes nothing, so two people editing
the same settings cannot overwrite each other unseen. On a 409 the section reads the settings again,
drops the edit and says so. Workspace reads and saves are `{ values, version }`; a new form's
`settings` in the create body carries no version.

Audit: every save the API takes adds a `settings_audit` row in the same transaction: the workspace,
the form (none for a workspace-level save), the group key, the version after the save, the actor's
id and label, and the fields the save wrote, before and after. Rows are never changed; only dev-data
purge removes them. Internal writes such as dev-data seeding are not audited.

Shared groups: a group whose values a workspace shares with its forms also declares `workspace`.
The workspace has its own row, created with the workspace by `createTeamWorkspace`. Each form's row
says whether the form inherits the workspace's values or keeps its own. A form that inherits uses
the workspace's values, read when asked, so a workspace change reaches it with nothing copied; going
back to inherit drops the form's own values. A create request may carry `settings`, such as
`{ audience: { inherit: false, values } }`, and the named groups then start with the form's own
values; the rest inherit. The lib helper `inheritableSettingsSchemas` builds a
shared group's schemas: the workspace values, the form's view (`inherit`, `own`, `workspace`,
`effective`) and the form's save body (`{ inherit: true }` or `{ inherit: false, values }`).

A module's `router` is a factory, so importing the registry builds nothing.

Dev-data purge clears every module's `tables` before deleting forms.

## Frontend: `frontend/src/features/form-settings/`

| file                                                 | role                                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                                           | `FormSettingsSection`: `id`, `weight`, optional `featureCode`, `scoped`, `Drawer`                                          |
| `data/api.ts`, `data/useFormSettings.ts`             | generic read and save of a form's group by key                                                                             |
| `data/useWorkspaceSettings.ts`                       | the same for a workspace's group; a save re-reads that group for loaded forms                                              |
| `data/sections.ts`                                   | the tab's sections for a form, without those whose feature is off                                                          |
| `registry.ts`                                        | the sections of a form's Settings tab and of a workspace's Form Settings tab, lowest `weight` first                        |
| `ui/FormSettingsDrawers.tsx`                         | the accordion section with Save and Cancel                                                                                 |
| `ui/WorkspaceFormSettings.tsx`                       | a workspace's Form Settings tab: an intro, then a drawer for each workspace section                                        |
| `ui/InheritCheckbox.tsx`, `ui/useInheritableEdit.ts` | a shared group's "Use the workspace setting" choice, and the edit layered over its loaded view                             |
| `<group>/`                                           | the section components and `index.ts` (the section descriptors; a shared group has a form section and a workspace section) |

Form Settings (10) and Form Profile (20) save through the form update; Form Audience (25) and
Submitter Settings (30) use their group endpoints. The audience's login providers come from
`GET /meta/login-providers` through `useLoginProviders`.

A workspace's Form Settings tab holds one section per shared group: Form Audience (10) and Submitter
Settings (20). Only workspace owners and admins reach the page, so the sections are editable there.

A section's `weight` orders the Settings tab. A module's `weight` orders mounting. The two are
unrelated, and one group's numbers need not match.

## Feature flags

- No flag: omit `featureCode`.
- Part of an existing feature: set `featureCode` to that feature.
- `fixed` feature: the backend returns 404 while it is off; the section follows the deployment's
  feature flags.
- `scoped` feature (granted per workspace or form): the backend checks the form's grant; set
  `scoped: true` so the section asks the server for this form.

## Adding a group

1. Migration `NNNN_form_<group>_setting.sql`: the table (`id`, `workspace_id`, unique `form_id`, typed
   flag columns with `NOT NULL DEFAULT`, audit columns) and a backfill for existing forms.
2. Drizzle table in `backend/src/core/db/schema/`, exported from the schema index.
3. Lib schemas in `lib/src/schemas/formSettings/<group>.ts`, exported from its index.
4. Backend module folder, added to `form-settings/registry.ts`.
5. Frontend section folder, added to `form-settings/registry.ts`, with text under `form.settings`
   in `en.json` and `fr.json`.

A new flag in an existing group is a migration (`ADD COLUMN ... NOT NULL DEFAULT`), the schema and
lib field, and the section control.
