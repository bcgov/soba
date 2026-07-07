-- Marks the two bootstrap groups so team-guard protections don't depend on the (renameable) name.
ALTER TABLE "soba"."workspace_group" ADD COLUMN "system_code" text;--> statement-breakpoint
UPDATE "soba"."workspace_group" SET "system_code" = 'form_admins' WHERE "name" = 'Form administrators';--> statement-breakpoint
UPDATE "soba"."workspace_group" SET "system_code" = 'form_submitters' WHERE "name" = 'Form submitters';
