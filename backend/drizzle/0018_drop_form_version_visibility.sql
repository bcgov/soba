-- Seed each workspace's Form submitters group from its forms' legacy visibility, then drop the column.
-- public -> public idp member; idir -> azureidir; no public/idir tokens -> azureidir default.

-- public forms: allow anonymous submitters.
INSERT INTO "soba"."workspace_group_membership"
	("id","workspace_id","group_id","member_kind","identity_provider_code","status","created_by","updated_by")
SELECT gen_random_uuid(), g."workspace_id", g."id", 'idp', 'public', 'active',
	'SOBA System (migration)', 'SOBA System (migration)'
FROM "soba"."workspace_group" g
WHERE g."system_code" = 'form_submitters' AND g."status" = 'active'
	AND EXISTS (
		SELECT 1 FROM "soba"."form_version" fv
		WHERE fv."workspace_id" = g."workspace_id" AND fv."deleted_at" IS NULL
			AND 'public' = ANY(fv."visibility")
	)
	AND NOT EXISTS (
		SELECT 1 FROM "soba"."workspace_group_membership" m
		WHERE m."group_id" = g."id" AND m."member_kind" = 'idp' AND m."identity_provider_code" = 'public'
	);--> statement-breakpoint

-- idir forms: allow azureidir submitters.
INSERT INTO "soba"."workspace_group_membership"
	("id","workspace_id","group_id","member_kind","identity_provider_code","status","created_by","updated_by")
SELECT gen_random_uuid(), g."workspace_id", g."id", 'idp', 'azureidir', 'active',
	'SOBA System (migration)', 'SOBA System (migration)'
FROM "soba"."workspace_group" g
WHERE g."system_code" = 'form_submitters' AND g."status" = 'active'
	AND EXISTS (
		SELECT 1 FROM "soba"."form_version" fv
		WHERE fv."workspace_id" = g."workspace_id" AND fv."deleted_at" IS NULL
			AND 'idir' = ANY(fv."visibility")
	)
	AND NOT EXISTS (
		SELECT 1 FROM "soba"."workspace_group_membership" m
		WHERE m."group_id" = g."id" AND m."member_kind" = 'idp' AND m."identity_provider_code" = 'azureidir'
	);--> statement-breakpoint

-- Undetermined (no public or idir tokens): default to azureidir.
INSERT INTO "soba"."workspace_group_membership"
	("id","workspace_id","group_id","member_kind","identity_provider_code","status","created_by","updated_by")
SELECT gen_random_uuid(), g."workspace_id", g."id", 'idp', 'azureidir', 'active',
	'SOBA System (migration)', 'SOBA System (migration)'
FROM "soba"."workspace_group" g
WHERE g."system_code" = 'form_submitters' AND g."status" = 'active'
	AND NOT EXISTS (
		SELECT 1 FROM "soba"."form_version" fv
		WHERE fv."workspace_id" = g."workspace_id" AND fv."deleted_at" IS NULL
			AND ('public' = ANY(fv."visibility") OR 'idir' = ANY(fv."visibility"))
	)
	AND NOT EXISTS (
		SELECT 1 FROM "soba"."workspace_group_membership" m
		WHERE m."group_id" = g."id" AND m."member_kind" = 'idp' AND m."identity_provider_code" = 'azureidir'
	);--> statement-breakpoint

-- Drop the retired column.
ALTER TABLE "soba"."form_version" DROP COLUMN "visibility";
