-- A form group override either replaces the group's members on the form (existing rows) or adjusts
-- them: the workspace group's members stay, and each member row includes or excludes one person.
ALTER TABLE "soba"."form_group_override" ADD COLUMN "mode" text DEFAULT 'replace' NOT NULL;--> statement-breakpoint
ALTER TABLE "soba"."form_group_override" ADD CONSTRAINT "form_group_override_mode_check" CHECK ("mode" IN ('replace', 'adjust'));--> statement-breakpoint
ALTER TABLE "soba"."form_group_override_member" ADD COLUMN "effect" text DEFAULT 'include' NOT NULL;--> statement-breakpoint
ALTER TABLE "soba"."form_group_override_member" ADD CONSTRAINT "form_group_override_member_effect_check" CHECK ("effect" IN ('include', 'exclude'));
