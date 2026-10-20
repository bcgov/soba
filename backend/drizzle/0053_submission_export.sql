ALTER TABLE "soba"."submission" ADD COLUMN "submitted_ip" text;--> statement-breakpoint
ALTER TABLE "soba"."submission" ADD COLUMN "submitted_user_agent" text;--> statement-breakpoint
CREATE TABLE "soba"."submission_export" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"exported_by" uuid NOT NULL,
	"to_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "soba"."submission_export" ADD CONSTRAINT "submission_export_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission_export" ADD CONSTRAINT "submission_export_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "soba"."form"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission_export" ADD CONSTRAINT "submission_export_exported_by_app_user_id_fk" FOREIGN KEY ("exported_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_export_form_exporter_idx" ON "soba"."submission_export" ("form_id", "exported_by", "created_at");
