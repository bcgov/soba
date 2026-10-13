# Form settings

A form's settings live in self-contained groups. Each group owns its table, API, schemas and
Settings tab section. The forms route, controller, service and schema files do not reference them.

To add a group, follow [How to add a form settings group](how-to-add-form-settings.md); this page is
the reference for what the pieces are.

## Backend: `backend/src/features/form-settings/`

| file          | role                                                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`    | `FormSettingsModule`: `key`, `weight`, optional `featureCode`, `router()`, `registerOpenApi`, `tables`                                                     |
| `routes.ts`   | `settingsRoutes(service, bodySchema)`: GET (`form_read`) and PUT (`form_update`, body validated)                                                           |
| `schema.ts`   | `registerSettingsPaths`: the standard OpenAPI entries for a group                                                                                          |
| `router.ts`   | mounts every module at `/design/forms/:id/settings/<key>`, after resolving the form and checking the module's feature for that form (404 when unavailable) |
| `registry.ts` | the list of modules, lowest `weight` first                                                                                                                 |
| `<group>/`    | `repo.ts`, `service.ts`, `openapi.ts`, `index.ts` (the module descriptor)                                                                                  |

Rows: each group's migration backfills a row for every live form. A read or save goes straight to
the row; a form without one gets it on that access, filled from the column defaults and stamped
`SOBA System (auto)`, so defaults exist only in the database and form creation does not know about
settings. Other features read a group through its service.

A module's `router` is a factory, so importing the registry builds nothing.

Dev-data purge clears every module's `tables` before deleting forms.

## Frontend: `frontend/src/features/form-settings/`

| file                           | role                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `types.ts`                     | `FormSettingsSection`: `id`, `weight`, optional `featureCode`, `scoped`, `Drawer` |
| `api.ts`, `useFormSettings.ts` | generic read and save of a group by key                                           |
| `sections.ts`                  | the tab's sections for a form, without those whose feature is off                 |
| `registry.ts`                  | the list of sections, lowest `weight` first                                       |
| `ui/FormSettingsDrawers.tsx`   | the accordion section with Save and Cancel                                        |
| `<group>/`                     | the section component and `index.ts` (the section descriptor)                     |

Form Settings (10) and Form Profile (20) save through the form update; Submitter Settings (30) uses
its group endpoint.

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
