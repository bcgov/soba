-- Grandfather existing active workspaces so the new disclaimer gate only affects newly created ones.
-- Acceptance is attributed to each workspace's earliest active owner.
INSERT INTO "soba"."workspace_disclaimer_acceptance" ("workspace_id","accepted_by_user_id","accepted_at","created_by","updated_by")
SELECT w."id", m."user_id", now(), 'SOBA System (migration)', 'SOBA System (migration)'
FROM "soba"."workspace" w
JOIN LATERAL (
	SELECT "user_id" FROM "soba"."workspace_membership"
	WHERE "workspace_id" = w."id" AND "role" = 'owner' AND "status" = 'active'
	ORDER BY "created_at" LIMIT 1
) m ON true
WHERE w."status" = 'active'
	AND NOT EXISTS (SELECT 1 FROM "soba"."workspace_disclaimer_acceptance" a WHERE a."workspace_id" = w."id");
