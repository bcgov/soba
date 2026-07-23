INSERT INTO "soba"."feature" ("code","name","description","version","status","availability","created_by","updated_by") VALUES
	('document-generation','Document generation','Render documents from templates on the submit surface',NULL,'enabled','fixed','SOBA System (seed)','SOBA System (seed)'),
	('document-generation-v2','Document generation (CDOGS v2)','CDOGS v2 document-generation backend',NULL,'enabled','fixed','SOBA System (seed)','SOBA System (seed)'),
	('document-generation-v3','Document generation (CDOGS v3)','CDOGS v3 (Carbone Enterprise) document-generation backend; granted per workspace/form',NULL,'enabled','scoped','SOBA System (seed)','SOBA System (seed)')
ON CONFLICT DO NOTHING;
