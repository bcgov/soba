CREATE TABLE "soba"."document_generation_template" (
	"id" uuid PRIMARY KEY NOT NULL,
	"file_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "soba"."document_generation_form_configuration" (
	"form_id" uuid PRIMARY KEY NOT NULL,
	"printable_name" text,
	"default_template_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "soba"."document_generation_template" ADD CONSTRAINT "document_generation_template_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "soba"."file"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "soba"."document_generation_template" ADD CONSTRAINT "document_generation_template_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "soba"."form"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "soba"."document_generation_form_configuration" ADD CONSTRAINT "document_generation_form_configuration_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "soba"."form"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "soba"."document_generation_form_configuration" ADD CONSTRAINT "document_generation_form_configuration_default_template_id_document_generation_template_id_fk" FOREIGN KEY ("default_template_id") REFERENCES "soba"."document_generation_template"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "document_generation_template_file_uq" ON "soba"."document_generation_template" ("file_id");
CREATE INDEX "document_generation_template_form_idx" ON "soba"."document_generation_template" ("form_id");
CREATE INDEX "document_generation_form_configuration_default_template_idx" ON "soba"."document_generation_form_configuration" ("default_template_id");