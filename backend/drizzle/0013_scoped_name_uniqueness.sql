-- Workspace names become unique per kind below; fail early (before any DDL) with a clear message
-- if existing data would violate it, since names were previously unconstrained.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "soba"."workspace" GROUP BY "kind", "name" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate (kind, name) workspaces exist; rename them before applying workspace_kind_name_uq';
  END IF;
END $$;--> statement-breakpoint
-- Group name uniqueness applies to active groups only, so a soft-deleted group frees its name.
DROP INDEX "soba"."workspace_group_workspace_name_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_group_workspace_name_uq" ON "soba"."workspace_group" USING btree ("workspace_id","name") WHERE "status" = 'active';--> statement-breakpoint
-- Form name uniqueness applies to non-deleted forms only, so a soft-deleted form frees its name.
DROP INDEX "soba"."form_workspace_name_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "form_workspace_name_uq" ON "soba"."form" USING btree ("workspace_id","name") WHERE "deleted_at" IS NULL;--> statement-breakpoint
-- Drop the unused slug column/index; workspace names are unique per kind instead.
DROP INDEX "soba"."workspace_slug_uq";--> statement-breakpoint
ALTER TABLE "soba"."workspace" DROP COLUMN "slug";--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_kind_name_uq" ON "soba"."workspace" USING btree ("kind","name");
