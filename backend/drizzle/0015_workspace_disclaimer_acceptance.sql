CREATE TABLE "soba"."workspace_disclaimer_acceptance" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"accepted_by_user_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "soba"."workspace_disclaimer_acceptance" ADD CONSTRAINT "workspace_disclaimer_acceptance_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_disclaimer_acceptance" ADD CONSTRAINT "workspace_disclaimer_acceptance_accepted_by_user_id_app_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;
