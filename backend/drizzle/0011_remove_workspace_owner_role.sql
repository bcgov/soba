DELETE FROM "soba"."workspace_group_membership" WHERE "group_id" IN (
	SELECT "id" FROM "soba"."workspace_group" WHERE "name" = 'Workspace owners'
);--> statement-breakpoint
DELETE FROM "soba"."workspace_group_role" WHERE "role_code" = 'workspace_owner';--> statement-breakpoint
DELETE FROM "soba"."workspace_group" WHERE "name" = 'Workspace owners';--> statement-breakpoint
DELETE FROM "soba"."role" WHERE "code" = 'workspace_owner';
