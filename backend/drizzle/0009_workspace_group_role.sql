CREATE TABLE "soba"."workspace_group_role" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"role_code" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_role" ADD CONSTRAINT "workspace_group_role_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_role" ADD CONSTRAINT "workspace_group_role_group_id_workspace_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "soba"."workspace_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_role" ADD CONSTRAINT "workspace_group_role_role_code_role_code_fk" FOREIGN KEY ("role_code") REFERENCES "soba"."role"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_group_role_group_role_uq" ON "soba"."workspace_group_role" ("group_id","role_code");--> statement-breakpoint
CREATE INDEX "workspace_group_role_group_idx" ON "soba"."workspace_group_role" ("group_id");--> statement-breakpoint
CREATE INDEX "workspace_group_role_role_idx" ON "soba"."workspace_group_role" ("role_code");--> statement-breakpoint
INSERT INTO "soba"."workspace_group_role" ("id","workspace_id","group_id","role_code","status","created_by","updated_by")
SELECT gen_random_uuid(), "workspace_id", "id", "role_code", 'active', 'SOBA System (migration)', 'SOBA System (migration)'
FROM "soba"."workspace_group" WHERE "role_code" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group" DROP COLUMN "role_code";
