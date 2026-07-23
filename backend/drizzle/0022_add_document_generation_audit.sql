CREATE TABLE "soba"."document_generation_audit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"backend_code" text NOT NULL,
	"outcome" text NOT NULL,
	"http_status" integer,
	"duration_ms" integer NOT NULL,
	"error_detail" text,
	"request_id" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "soba"."document_generation_audit" ADD CONSTRAINT "document_generation_audit_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."document_generation_audit" ADD CONSTRAINT "document_generation_audit_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "soba"."form"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."document_generation_audit" ADD CONSTRAINT "document_generation_audit_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "soba"."submission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."document_generation_audit" ADD CONSTRAINT "document_generation_audit_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_generation_audit_workspace_created_idx" ON "soba"."document_generation_audit" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "document_generation_audit_form_created_idx" ON "soba"."document_generation_audit" ("form_id","created_at");
