ALTER TABLE "soba"."identity_provider" ADD COLUMN "is_login_provider" boolean DEFAULT true NOT NULL;--> statement-breakpoint
INSERT INTO "soba"."identity_provider" ("code","name","hint","is_active","is_login_provider","created_by","updated_by") VALUES
	('public','Public','public',true,false,'SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "soba"."identity_provider" SET "is_login_provider" = false WHERE "code" = 'system';--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_membership" ALTER COLUMN "workspace_membership_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_membership" ADD COLUMN "member_kind" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_membership" ADD COLUMN "identity_provider_code" text;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_membership" ADD COLUMN "idp_group_code" text;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_membership" ADD CONSTRAINT "workspace_group_membership_idp_code_fk" FOREIGN KEY ("identity_provider_code") REFERENCES "soba"."identity_provider"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_membership" ADD CONSTRAINT "workspace_group_membership_idp_group_code_fk" FOREIGN KEY ("idp_group_code") REFERENCES "soba"."idp_group"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_membership" ADD CONSTRAINT "workspace_group_membership_member_kind_check" CHECK (
	("member_kind" = 'user' AND "workspace_membership_id" IS NOT NULL AND "identity_provider_code" IS NULL AND "idp_group_code" IS NULL)
	OR ("member_kind" = 'idp' AND "workspace_membership_id" IS NULL AND "identity_provider_code" IS NOT NULL AND "idp_group_code" IS NULL)
	OR ("member_kind" = 'idp_group' AND "workspace_membership_id" IS NULL AND "identity_provider_code" IS NULL AND "idp_group_code" IS NOT NULL)
);--> statement-breakpoint
DROP INDEX "soba"."workspace_group_membership_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_group_membership_user_uq" ON "soba"."workspace_group_membership" ("group_id","workspace_membership_id") WHERE "member_kind" = 'user';--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_group_membership_idp_uq" ON "soba"."workspace_group_membership" ("group_id","identity_provider_code") WHERE "member_kind" = 'idp';--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_group_membership_idp_group_uq" ON "soba"."workspace_group_membership" ("group_id","idp_group_code") WHERE "member_kind" = 'idp_group';
