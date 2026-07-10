INSERT INTO "soba"."feature" ("code","name","description","version","status","created_by","updated_by") VALUES
	('cdogs','CDOGS','Integration with CDOGS document generation API',NULL,'enabled','SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
