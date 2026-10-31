CREATE UNIQUE INDEX "form_workspace_id_uq" ON "soba"."form" ("workspace_id", "id");
--> statement-breakpoint
ALTER TABLE "soba"."workspace_credential" ADD COLUMN "form_id" uuid;
--> statement-breakpoint
ALTER TABLE "soba"."workspace_credential" ADD CONSTRAINT "workspace_credential_form_workspace_fk"
  FOREIGN KEY ("workspace_id", "form_id") REFERENCES "soba"."form" ("workspace_id", "id");
--> statement-breakpoint
CREATE INDEX "workspace_credential_form_idx" ON "soba"."workspace_credential" ("form_id");
--> statement-breakpoint
CREATE TABLE "soba"."credential_type" (
  "code" text PRIMARY KEY NOT NULL,
  CONSTRAINT "credential_type_code_check" CHECK ("code" IN ('api', 'web-component'))
);
--> statement-breakpoint
INSERT INTO "soba"."credential_type" ("code") VALUES ('api'), ('web-component');
--> statement-breakpoint
CREATE TABLE "soba"."credential_type_assignment" (
  "credential_id" uuid NOT NULL REFERENCES "soba"."workspace_credential" ("id"),
  "type_code" text NOT NULL REFERENCES "soba"."credential_type" ("code"),
  PRIMARY KEY ("credential_id", "type_code")
);
--> statement-breakpoint
CREATE INDEX "credential_type_assignment_type_idx" ON "soba"."credential_type_assignment" ("type_code");
--> statement-breakpoint
INSERT INTO "soba"."credential_type_assignment" ("credential_id", "type_code")
  SELECT "id", unnest("types") FROM "soba"."workspace_credential";
--> statement-breakpoint
ALTER TABLE "soba"."workspace_credential" DROP CONSTRAINT "workspace_credential_types_check";
--> statement-breakpoint
ALTER TABLE "soba"."workspace_credential" DROP COLUMN "types";
