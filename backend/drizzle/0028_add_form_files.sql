ALTER TABLE "soba"."file" ADD COLUMN "form_id" uuid;
--> statement-breakpoint
ALTER TABLE "soba"."file" ADD CONSTRAINT "file_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "soba"."form"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "file_form_idx" ON "soba"."file" ("form_id");
