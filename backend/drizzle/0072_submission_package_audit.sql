CREATE TABLE "soba"."submission_package_audit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"file_id" uuid,
	"action" text NOT NULL,
	"size" integer,
	"request_id" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "soba"."submission_package_audit" ADD CONSTRAINT "submission_package_audit_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission_package_audit" ADD CONSTRAINT "submission_package_audit_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "soba"."form"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission_package_audit" ADD CONSTRAINT "submission_package_audit_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "soba"."submission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission_package_audit" ADD CONSTRAINT "submission_package_audit_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_package_audit_form_created_idx" ON "soba"."submission_package_audit" ("form_id","created_at");--> statement-breakpoint
CREATE INDEX "submission_package_audit_workspace_idx" ON "soba"."submission_package_audit" ("workspace_id");--> statement-breakpoint
CREATE INDEX "submission_package_audit_job_idx" ON "soba"."submission_package_audit" ("job_id");--> statement-breakpoint
INSERT INTO "soba"."feature" ("code","name","description","version","status","availability","created_by","updated_by") VALUES
	('post-submission-email-package','Post-submission email package','Emailing staff a link to a package of a submission when it is first submitted',NULL,'disabled','scoped','SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
