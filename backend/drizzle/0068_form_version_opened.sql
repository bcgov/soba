-- A new form version starts opened and becomes a draft on its first save. Opened sorts first, as
-- the earliest state.
UPDATE "soba"."form_version_state" SET "sort_order" = "sort_order" + 1
WHERE "code" IN ('draft','published','archived','deleted');
--> statement-breakpoint
INSERT INTO "soba"."form_version_state" ("code","source","display","sort_order","is_active") VALUES
	('opened','core','Opened',0,true)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- An opened version holds no number until it is saved, so one left unsaved does not keep the next
-- version from taking it. A deleted one may have been deleted while opened, so its number may since
-- have been taken. New numbers still count deleted versions, so none is reused.
DROP INDEX "soba"."form_version_workspace_form_version_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX "form_version_workspace_form_version_uq" ON "soba"."form_version" USING btree ("workspace_id","form_id","version_no") WHERE "state" NOT IN ('opened','deleted');
