-- Clean up any orphaned records before migrating to avoid foreign key violations on update
DELETE FROM "soba"."submission_revision" WHERE "workspace_id" NOT IN (SELECT "id" FROM "soba"."workspace");
DELETE FROM "soba"."submission" WHERE "workspace_id" NOT IN (SELECT "id" FROM "soba"."workspace");
DELETE FROM "soba"."form_version_revision" WHERE "workspace_id" NOT IN (SELECT "id" FROM "soba"."workspace");
DELETE FROM "soba"."form_version" WHERE "workspace_id" NOT IN (SELECT "id" FROM "soba"."workspace");
DELETE FROM "soba"."form" WHERE "workspace_id" NOT IN (SELECT "id" FROM "soba"."workspace");

ALTER TABLE "soba"."form" ADD COLUMN "org" text;
ALTER TABLE "soba"."form" ADD COLUMN "use_case" text;

UPDATE "soba"."form"
SET "org" = w."org",
    "use_case" = w."use_case"
FROM "soba"."workspace" w
WHERE "soba"."form"."workspace_id" = w."id";

UPDATE "soba"."form" SET "org" = 'CITZ' WHERE "org" IS NULL;
UPDATE "soba"."form" SET "use_case" = 'collection' WHERE "use_case" IS NULL;

ALTER TABLE "soba"."form" ALTER COLUMN "org" SET NOT NULL;
ALTER TABLE "soba"."form" ALTER COLUMN "use_case" SET NOT NULL;
