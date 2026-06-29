INSERT INTO "soba"."feature_status" ("code","source","display","sort_order","is_active") VALUES
	('enabled','core','Enabled',0,true),
	('disabled','core','Disabled',1,true),
	('experimental','core','Experimental',2,true),
	('deprecated','core','Deprecated',3,true)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "soba"."feature" ("code","name","description","version","status","created_by","updated_by") VALUES
	('form-versions','Form versions',NULL,NULL,'enabled','SOBA System (seed)','SOBA System (seed)'),
	('submissions','Submissions',NULL,NULL,'enabled','SOBA System (seed)','SOBA System (seed)'),
	('meta','Meta',NULL,NULL,'enabled','SOBA System (seed)','SOBA System (seed)'),
	('workspaces','Workspaces','Workspace shell and membership (shared by design and submit flows)',NULL,'enabled','SOBA System (seed)','SOBA System (seed)'),
	('design-mode','Design mode','Form management and design surfaces',NULL,'enabled','SOBA System (seed)','SOBA System (seed)'),
	('submit-mode','Submit mode','Submitter-facing surfaces',NULL,'enabled','SOBA System (seed)','SOBA System (seed)'),
	('marketing','Marketing','Show Marketing screen on landing',NULL,'enabled','SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "soba"."role_status" ("code","display","sort_order","is_active") VALUES
	('active','Active',0,true),
	('deprecated','Deprecated',1,true)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "soba"."role" ("code","name","description","status","source","feature_code","created_by","updated_by") VALUES
	('workspace_owner','Workspace owner',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)'),
	('form_owner','Form owner',NULL,'active','core',NULL,'SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "soba"."form_status" ("code","source","display","sort_order","is_active") VALUES
	('active','core','Active',0,true),
	('archived','core','Archived',1,true),
	('deleted','core','Deleted',2,true)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "soba"."form_version_state" ("code","source","display","sort_order","is_active") VALUES
	('draft','core','Draft',0,true),
	('published','core','Published',1,true),
	('archived','core','Archived',2,true),
	('deleted','core','Deleted',3,true)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "soba"."workspace_membership_role" ("code","source","display","sort_order","is_active") VALUES
	('owner','core','Owner',0,true),
	('admin','core','Admin',1,true),
	('member','core','Member',2,true),
	('viewer','core','Viewer',3,true)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "soba"."workspace_membership_status" ("code","source","display","sort_order","is_active") VALUES
	('active','core','Active',0,true),
	('inactive','core','Inactive',1,true),
	('pending','core','Pending',2,true)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "soba"."identity_provider" ("code","name","hint","is_active","created_by","updated_by") VALUES
	('idir','IDIR','idir',false,'SOBA System (seed)','SOBA System (seed)'),
	('azureidir','IDIR - MFA','azureidir',true,'SOBA System (seed)','SOBA System (seed)'),
	('bceidbusiness','BCeID Business','bceidbusiness',false,'SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "soba"."idp_group" ("code","name","source","created_by","updated_by") VALUES
	('bcgov','BC Government','core','SOBA System (seed)','SOBA System (seed)'),
	('bceid','BCeID','core','SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "soba"."idp_group_member" ("group_code","identity_provider_code") VALUES
	('bcgov','idir'),
	('bcgov','azureidir'),
	('bceid','bceidbusiness')
ON CONFLICT DO NOTHING;
