DROP INDEX "soba"."workspace_credential_workspace_uq";
--> statement-breakpoint
CREATE INDEX "workspace_credential_workspace_idx" ON "soba"."workspace_credential" ("workspace_id");
--> statement-breakpoint
ALTER TABLE "soba"."workspace_credential" ADD COLUMN "label" text;
--> statement-breakpoint
UPDATE "soba"."workspace_credential" SET "label" = upper("id"::text);
--> statement-breakpoint
ALTER TABLE "soba"."workspace_credential" ALTER COLUMN "label" SET NOT NULL;
--> statement-breakpoint
-- Existing credentials predate purpose selection; retain their general API purpose.
ALTER TABLE "soba"."workspace_credential" ADD COLUMN "types" text[] DEFAULT ARRAY['api']::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "soba"."workspace_credential" ALTER COLUMN "types" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "soba"."workspace_credential" ADD CONSTRAINT "workspace_credential_types_check" CHECK (
  cardinality("types") BETWEEN 1 AND 2
  AND "types" <@ ARRAY['api', 'web-component']::text[]
  AND array_position("types", NULL) IS NULL
  AND (cardinality("types") = 1 OR "types"[1] <> "types"[2])
);
