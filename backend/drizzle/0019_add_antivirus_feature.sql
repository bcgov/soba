INSERT INTO "soba"."feature" ("code","name","description","version","status","created_by","updated_by") VALUES
	('antivirus','Antivirus','Virus scanning of uploaded files before they reach storage',NULL,'enabled','SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
