CREATE TABLE "soba"."workspace_credential" (
  "id" uuid PRIMARY KEY NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "soba"."workspace"("id"),
  "issuer_code" text NOT NULL,
  "client_id" text,
  "flow" text,
  "status" text NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "rotated_at" timestamp with time zone,
  CONSTRAINT "workspace_credential_status_check" CHECK ("status" IN ('issuing', 'active', 'rotating', 'unknown'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_credential_workspace_uq" ON "soba"."workspace_credential" ("workspace_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_credential_consumer_uq" ON "soba"."workspace_credential" ("issuer_code", "client_id");
--> statement-breakpoint
CREATE TABLE "soba"."credential_audit" (
  "id" uuid PRIMARY KEY NOT NULL,
  "credential_id" uuid NOT NULL REFERENCES "soba"."workspace_credential"("id"),
  "actor_id" uuid NOT NULL,
  "action" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
