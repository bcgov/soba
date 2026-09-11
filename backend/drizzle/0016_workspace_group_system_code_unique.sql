-- At most one system group per code per workspace, so the 0013 bootstrap tagging can't be duplicated.
CREATE UNIQUE INDEX "workspace_group_system_code_uq" ON "soba"."workspace_group" USING btree ("workspace_id","system_code") WHERE "system_code" IS NOT NULL;
