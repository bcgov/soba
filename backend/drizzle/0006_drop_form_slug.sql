DROP INDEX "soba"."form_workspace_slug_uq";--> statement-breakpoint
ALTER TABLE "soba"."form" DROP COLUMN "slug";--> statement-breakpoint
CREATE UNIQUE INDEX "form_workspace_name_uq" ON "soba"."form" ("workspace_id","name");
