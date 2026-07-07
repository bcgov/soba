CREATE TABLE "soba"."permission" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"source" text DEFAULT 'core' NOT NULL,
	"feature_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "soba"."permission" ADD CONSTRAINT "permission_feature_code_feature_code_fk" FOREIGN KEY ("feature_code") REFERENCES "soba"."feature"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "soba"."role_permission" (
	"role_code" text NOT NULL,
	"permission_code" text NOT NULL,
	CONSTRAINT "role_permission_role_code_permission_code_pk" PRIMARY KEY("role_code","permission_code")
);
--> statement-breakpoint
ALTER TABLE "soba"."role_permission" ADD CONSTRAINT "role_permission_role_code_role_code_fk" FOREIGN KEY ("role_code") REFERENCES "soba"."role"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."role_permission" ADD CONSTRAINT "role_permission_permission_code_permission_code_fk" FOREIGN KEY ("permission_code") REFERENCES "soba"."permission"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "soba"."permission" ("code","name","description","status","source","feature_code","created_by","updated_by") VALUES
	('*','All permissions','Grants all permissions','active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('form_read','Read form',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('form_update','Update form',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('form_delete','Delete form',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('design_create','Create design',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('design_read','Read design',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('design_update','Update design',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('design_delete','Delete design',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('submission_create','Create submission',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('submission_read','Read submission',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('submission_update','Update submission',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('submission_delete','Delete submission',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('submission_review','Review submission',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('team_read','Read team',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('team_update','Update team',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "soba"."role" ("code","name","description","status","source","feature_code","created_by","updated_by") VALUES
	('form_admin','Form admin','Full form access','active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('form_designer','Form designer',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('form_submitter','Form submitter',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('submission_reviewer','Submission reviewer',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('submission_approver','Submission approver',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "soba"."role_permission" ("role_code","permission_code") VALUES
	('form_admin','*'),
	('form_designer','form_read'),
	('form_designer','design_create'),
	('form_designer','design_read'),
	('form_designer','design_update'),
	('form_designer','design_delete'),
	('form_submitter','form_read'),
	('form_submitter','submission_create'),
	('submission_reviewer','form_read'),
	('submission_reviewer','submission_read'),
	('submission_reviewer','submission_update'),
	('submission_reviewer','submission_delete'),
	('submission_reviewer','submission_review'),
	('submission_approver','form_read'),
	('submission_approver','submission_read'),
	('submission_approver','submission_review'),
	('submission_approver','team_read')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DELETE FROM "soba"."role" WHERE "code" = 'form_owner';
