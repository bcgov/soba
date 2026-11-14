CREATE TABLE "soba"."workspace_confirmation_setting" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"allow_submitter_email_copy" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "soba"."workspace_confirmation_setting" ADD CONSTRAINT "workspace_confirmation_setting_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_confirmation_setting_workspace_uq" ON "soba"."workspace_confirmation_setting" ("workspace_id");--> statement-breakpoint
INSERT INTO "soba"."workspace_confirmation_setting" ("id", "workspace_id", "created_by", "updated_by")
SELECT gen_random_uuid(), w."id", 'SOBA System (migration)', 'SOBA System (migration)'
FROM "soba"."workspace" w;--> statement-breakpoint
CREATE TABLE "soba"."form_confirmation_setting" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"inherit" boolean DEFAULT true NOT NULL,
	"allow_submitter_email_copy" boolean,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "form_confirmation_setting_inherit_check" CHECK (
		("inherit" AND "allow_submitter_email_copy" IS NULL)
		OR (NOT "inherit" AND "allow_submitter_email_copy" IS NOT NULL)
	)
);
--> statement-breakpoint
ALTER TABLE "soba"."form_confirmation_setting" ADD CONSTRAINT "form_confirmation_setting_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form_confirmation_setting" ADD CONSTRAINT "form_confirmation_setting_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "soba"."form"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_confirmation_setting_form_uq" ON "soba"."form_confirmation_setting" ("form_id");--> statement-breakpoint
CREATE INDEX "form_confirmation_setting_workspace_idx" ON "soba"."form_confirmation_setting" ("workspace_id");--> statement-breakpoint
INSERT INTO "soba"."form_confirmation_setting" ("id", "workspace_id", "form_id", "created_by", "updated_by")
SELECT gen_random_uuid(), "workspace_id", "id", 'SOBA System (migration)', 'SOBA System (migration)'
FROM "soba"."form"
WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE TABLE "soba"."submitter_email_copy_request" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"address" text NOT NULL,
	"requested_by" uuid NOT NULL,
	"idp_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "soba"."submitter_email_copy_request" ADD CONSTRAINT "submitter_email_copy_request_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submitter_email_copy_request" ADD CONSTRAINT "submitter_email_copy_request_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "soba"."form"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submitter_email_copy_request" ADD CONSTRAINT "submitter_email_copy_request_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "soba"."submission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submitter_email_copy_request" ADD CONSTRAINT "submitter_email_copy_request_requested_by_app_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submitter_email_copy_request_created_idx" ON "soba"."submitter_email_copy_request" ("created_at");--> statement-breakpoint
CREATE INDEX "submitter_email_copy_request_submission_idx" ON "soba"."submitter_email_copy_request" ("submission_id");--> statement-breakpoint
CREATE INDEX "submitter_email_copy_request_address_created_idx" ON "soba"."submitter_email_copy_request" ("address","created_at");--> statement-breakpoint
INSERT INTO "soba"."feature" ("code","name","description","version","status","availability","created_by","updated_by") VALUES
	('submitter-email-copy','Submitter email copy','Letting submitters email themselves a copy of their submission confirmation',NULL,'disabled','fixed','SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
