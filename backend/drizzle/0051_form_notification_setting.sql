CREATE TABLE "soba"."form_notification_setting" (
 "id" uuid PRIMARY KEY NOT NULL,
 "workspace_id" uuid NOT NULL REFERENCES "soba"."workspace"("id"),
 "form_id" uuid NOT NULL REFERENCES "soba"."form"("id"),
 "recipients" text[] DEFAULT ARRAY[]::text[] NOT NULL,
 "version" integer DEFAULT 1 NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "created_by" text,
 "updated_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "form_notification_setting_form_uq" ON "soba"."form_notification_setting" ("form_id");
CREATE INDEX "form_notification_setting_workspace_idx" ON "soba"."form_notification_setting" ("workspace_id");
--> statement-breakpoint
INSERT INTO "soba"."form_notification_setting" ("id", "workspace_id", "form_id", "created_by", "updated_by")
SELECT gen_random_uuid(), "workspace_id", "id", 'SOBA System (migration)', 'SOBA System (migration)'
FROM "soba"."form" WHERE "deleted_at" IS NULL;
