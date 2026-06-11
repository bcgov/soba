DELETE FROM "soba"."feature" WHERE "code" = 'designer';
--> statement-breakpoint
UPDATE "soba"."identity_provider" SET "hint" = "code" WHERE "hint" = 'code';
