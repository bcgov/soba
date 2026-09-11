ALTER TABLE "soba"."feature" ADD COLUMN "availability" text DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
CREATE TABLE "soba"."feature_scope" (
	"id" uuid PRIMARY KEY NOT NULL,
	"feature_code" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "soba"."feature_scope" ADD CONSTRAINT "feature_scope_feature_code_feature_code_fk" FOREIGN KEY ("feature_code") REFERENCES "soba"."feature"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_scope_code_scope_uq" ON "soba"."feature_scope" ("feature_code","scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "feature_scope_scope_idx" ON "soba"."feature_scope" ("scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "feature_scope_code_idx" ON "soba"."feature_scope" ("feature_code");
