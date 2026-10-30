-- CCP-6224 task 4: a form's submissions list, filtered and sorted by its review, reads by form.
CREATE INDEX IF NOT EXISTS "submission_form_idx" ON "soba"."submission" ("form_id");
