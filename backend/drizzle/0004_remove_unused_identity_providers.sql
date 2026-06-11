DELETE FROM "soba"."idp_group_member" WHERE "identity_provider_code" IN ('bcsc', 'bcservicescard', 'bceidbasic');
--> statement-breakpoint
DELETE FROM "soba"."idp_group_member" WHERE "group_code" = 'bc-citizens';
--> statement-breakpoint
DELETE FROM "soba"."idp_group" WHERE "code" = 'bc-citizens';
--> statement-breakpoint
DELETE FROM "soba"."identity_provider" WHERE "code" IN ('bcsc', 'bcservicescard', 'bceidbasic');
