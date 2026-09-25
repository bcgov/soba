# How to add a form settings group

A worked guide modelled on `submitter`, the group that ships today. Replace `<group>` with your
group's name throughout; the submitter files are the reference copy for every step.

For what the pieces are and how they fit, see [Form settings](form-settings.md).

## Before you start

- **Adding a flag to an existing group?** See the [last section](#adding-a-flag-to-an-existing-group).
- **Pick the group name.** It becomes the URL segment (`/design/forms/:id/settings/<group>`), the
  table name (`form_<group>_setting`), the SWR key and the OpenAPI component prefix.
- **Decide the defaults.** Every flag is a typed column with a `NOT NULL DEFAULT`. That default is
  the only one: no code supplies a fallback.
- **Decide the feature.** A group can be always on, part of an existing feature, or behind its own.

## 1. Migration

`backend/drizzle/NNNN_form_<group>_setting.sql`, modelled on `0034_form_submitter_setting.sql`:

```sql
CREATE TABLE "soba"."form_<group>_setting" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"<flag>" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
-- foreign keys to workspace and form, a unique index on form_id, an index on workspace_id
--> statement-breakpoint
INSERT INTO "soba"."form_<group>_setting" ("id", "workspace_id", "form_id", "created_by", "updated_by")
SELECT gen_random_uuid(), "workspace_id", "id", 'SOBA System (migration)', 'SOBA System (migration)'
FROM "soba"."form"
WHERE "deleted_at" IS NULL;
```

Add the journal entry in `backend/drizzle/meta/_journal.json` with a `when` higher than every
migration already merged. The migrator applies an entry only when its `when` is newer than the last
applied one, so a migration that reaches an environment out of order is skipped silently.

The backfill covers live forms; forms created later get their row on first access (step 4).

## 2. Drizzle table

`backend/src/core/db/schema/form<Group>Setting.ts`, following `formSubmitterSetting.ts`: `idColumn()`,
`workspace_id` and `form_id` references, the typed flag columns, `auditColumns()`, a unique index on
`formId` and an index on `workspaceId`. Export it from `backend/src/core/db/schema/index.ts`.

The table lives here, not in the module, because the schema index is what the migration tooling, the
database client and the purge coverage test read.

## 3. Lib schemas

`lib/src/schemas/formSettings/<group>.ts`:

```ts
import { z } from 'zod';

/** URL segment of the group, shared by the route, the SWR key and the OpenAPI component names. */
export const <GROUP>_SETTINGS_KEY = '<group>';

export const <Group>SettingsSchema = z.object({
  <flag>: z.boolean(),
});

/** A save sends every setting in the group. */
export const Set<Group>SettingsBodySchema = <Group>SettingsSchema;

export type <Group>Settings = z.infer<typeof <Group>SettingsSchema>;
export type Set<Group>SettingsBody = z.infer<typeof Set<Group>SettingsBodySchema>;
```

Export it from `lib/src/schemas/formSettings/index.ts`, and add a test beside
`lib/tests/schemas/formSettings/submitter.test.ts` covering a valid body and a missing or mistyped
flag.

## 4. Backend module

`backend/src/features/form-settings/<group>/`, four files:

- **`repo.ts`**: `ensure<Group>Settings`, `find<Group>Settings`, `update<Group>Settings`. `ensure`
  checks the form is live and in the workspace, then inserts with `onConflictDoNothing` on `formId`,
  so the row's values come from the column defaults.
- **`service.ts`**: implements `FormSettingsService<TSettings, TBody>` from `../routes`. `get` finds
  the row and `set` updates it; only a miss calls `ensure` and retries, so the usual request is one
  statement. Both throw `NotFoundError` when the row is still missing. Other features read the group
  through this service, never through its table.
- **`openapi.ts`**: the OpenAPI clones, with the key from the lib schema:

```ts
export const <Group>SettingsSchema = Lib<Group>SettingsSchema.clone().openapi('FormSettings_<Group>');
export const Set<Group>SettingsBodySchema =
  LibSet<Group>SettingsBodySchema.clone().openapi('FormSettings_Set<Group>Body');

export const register<Group>SettingsOpenApi: RegisterOpenApiPaths = (registry) =>
  registerSettingsPaths(registry, {
    key: <GROUP>_SETTINGS_KEY,
    label: '<group> settings',
    settingsSchema: <Group>SettingsSchema,
    bodySchema: Set<Group>SettingsBodySchema,
  });
```

- **`index.ts`**: the descriptor:

```ts
export const <group>SettingsModule: FormSettingsModule = {
  key: <GROUP>_SETTINGS_KEY,
  weight: 20,
  router: () => settingsRoutes(<group>SettingsService, Set<Group>SettingsBodySchema),
  registerOpenApi: register<Group>SettingsOpenApi,
  tables: [form<Group>Settings],
};
```

Add it to `backend/src/features/form-settings/registry.ts`. That is the only file outside the module
that changes: the mounting router, OpenAPI registration and dev-data purge all read the registry.

`settingsRoutes` gives the group `GET` (needs `form_read`) and `PUT` (needs `form_update`, body
validated against the schema). Write your own router only if the group needs more than those two.

## 5. Frontend section

`frontend/src/features/form-settings/<group>/`, two files:

- **`<Group>SettingsDrawer.tsx`**: the section body, wrapped in `FormSettingsDrawers` (which
  supplies the accordion, Save and Cancel). Read and write with the generic hook:

```ts
const { settings, error, save } = useFormSettings<<Group>Settings, Set<Group>SettingsBody>(
  <GROUP>_SETTINGS_KEY,
  formId,
);
```

Follow `SubmitterSettingsDrawer.tsx` for the rest: edits layered over the loaded value (null means
no edit), a save guarded against double clicks, a load-error alert built with `loadErrorMessage`,
controls disabled until the data is known, and a `data-testid` on every control.

- **`index.ts`**: the descriptor:

```ts
export const <group>Section: FormSettingsSection = {
  id: '<group>-settings',
  weight: 40,
  Drawer: <Group>SettingsDrawer,
};
```

Add it to `frontend/src/features/form-settings/registry.ts`. Weights run 10 (Form Settings), 20
(Form Profile), 30 (Submitter Settings); leave gaps so a later section can slot between. This weight
orders the tab and is unrelated to the module's, which orders mounting.

Add the section's text under `form.settings` in `frontend/dictionaries/en.json` and `fr.json`: the
section label, each control's label, and any note or load-error message.

## 6. Feature flag (optional)

| the group is                | backend                        | frontend                            |
| --------------------------- | ------------------------------ | ----------------------------------- |
| always on                   | omit `featureCode`             | omit `featureCode`                  |
| part of an existing feature | `featureCode: Features.<code>` | `featureCode: FEATURE_CODES.<CODE>` |
| behind a `scoped` feature   | same                           | also `scoped: true`                 |

With a `featureCode`, the group's routes return 404 wherever the feature is unavailable for that
form, and the section is hidden. A `scoped` feature is granted per workspace or form, so the section
asks the server about this form; anything that fails to answer hides the section.

## 7. Tests

- **Lib:** the schema test from step 3.
- **Frontend:** a section test beside
  `frontend/tests/features/form-settings/submitter/SubmitterSettingsDrawer.test.tsx`, covering the
  saved value, a save, a failed save, a failed read, and whatever gating the section has.
- **Backend:** the shared routes helper and the registry are covered once, in
  `backend/tests/features/form-settings`. A group adds no all-mock service tests of its own: cover
  its repo and service with a throwaway script against the local database (see step 8) and delete it
  afterwards.
- The purge coverage test fails if the new table is not reachable from the registry, which is the
  reminder that the module's `tables` list is missing it.

## 8. Verify

Run everything in the devcontainer:

```bash
docker exec soba-devcontainer-app-1 bash -lc 'cd /workspaces/soba/backend && pnpm db:migrate'
```

```bash
docker exec soba-devcontainer-app-1 bash -lc 'cd /workspaces/soba/lib && pnpm build && npx jest'
```

```bash
docker exec soba-devcontainer-app-1 bash -lc 'cd /workspaces/soba/backend && npx tsc --noEmit && npx eslint src tests && npx jest'
```

```bash
docker exec soba-devcontainer-app-1 bash -lc 'cd /workspaces/soba/frontend && npx tsc --noEmit && npx eslint src tests && npx vitest run'
```

Then a throwaway script against the local database for: the backfill, a read, a save, a form with no
row (reads the defaults, creates one row), and an unknown form (404). Finish in the browser: the
section appears in the right place, saves, and survives a reload.

## Adding a flag to an existing group

1. A migration adding the column, whose default fills every existing row:

   ```sql
   ALTER TABLE "soba"."form_<group>_setting" ADD COLUMN "<flag>" boolean DEFAULT false NOT NULL;
   ```

2. The column in the Drizzle table.
3. The field in the lib schema, and the mapping in the module's `service.ts` and `repo.ts`.
4. The control in the section, with its dictionary text and tests.

The endpoint, the registry and the section descriptor stay as they are.

## Gotchas

- **Defaults live in the database only.** No server code supplies a fallback; `ensure` exists so
  reads and saves always have a row. A section may still show a placeholder while the value loads.
- **`PUT` replaces the whole group.** The body carries every flag, so the section sends the values it
  loaded plus the change.
- **Form creation knows nothing about settings.** Do not add a group's insert to `FormService.create`.
- **The group name is load-bearing.** It appears in the URL, the SWR key and the OpenAPI component
  names; changing it later is a breaking API change.
- **Migration order.** Merge the group's PR after any PR carrying a lower-numbered migration, and
  resolve `_journal.json` conflicts by keeping every entry in `idx` order.
