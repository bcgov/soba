CREATE TABLE "soba"."credential_permission" (
  "credential_id" uuid NOT NULL REFERENCES "soba"."workspace_credential"("id") ON DELETE CASCADE,
  "permission_code" text NOT NULL,
  PRIMARY KEY ("credential_id", "permission_code"),
  CONSTRAINT "credential_permission_code_check" CHECK ("permission_code" IN ('submission_read'))
);
