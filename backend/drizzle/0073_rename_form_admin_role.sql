-- The fixed form_admin role is named to match its group, Form administrators.
UPDATE "soba"."role"
SET "name" = 'Form administrator', "updated_at" = now(), "updated_by" = 'SOBA System (seed)'
WHERE "code" = 'form_admin' AND "name" = 'Form admin';
