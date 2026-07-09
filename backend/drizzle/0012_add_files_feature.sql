CREATE TABLE "soba"."file" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile" text NOT NULL,
	"backend_ref" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text,
	"size" integer,
	"submission_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "soba"."file" ADD CONSTRAINT "file_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_workspace_idx" ON "soba"."file" ("workspace_id");--> statement-breakpoint
CREATE INDEX "file_submission_idx" ON "soba"."file" ("submission_id");--> statement-breakpoint
INSERT INTO "soba"."feature" ("code","name","description","version","status","created_by","updated_by") VALUES
	('files','Files','File upload/download API for form attachments',NULL,'enabled','SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
