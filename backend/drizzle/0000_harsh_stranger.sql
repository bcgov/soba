CREATE SCHEMA "soba";
--> statement-breakpoint
CREATE TABLE "soba"."app_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_label" text,
	"profile" jsonb,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."identity_provider" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."user_identity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"identity_provider_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"external_user_id" text,
	"idp_attributes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."workspace_group_membership" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"workspace_membership_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."workspace_group" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"external_group_id" text,
	"name" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."workspace_membership" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"invited_by_user_id" uuid,
	"invited_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."workspace" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"status" text NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."form_version_revision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_version_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"event_type" text NOT NULL,
	"before_engine_schema_ref" text,
	"after_engine_schema_ref" text,
	"changed_by" uuid NOT NULL,
	"change_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "soba"."form_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"state" text NOT NULL,
	"engine_schema_ref" text,
	"engine_sync_status" text NOT NULL,
	"engine_sync_error" text,
	"current_revision_no" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."form" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_engine_code" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."submission_revision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"event_type" text NOT NULL,
	"before_engine_submission_ref" text,
	"after_engine_submission_ref" text,
	"changed_by" uuid NOT NULL,
	"change_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "soba"."submission" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"form_version_id" uuid NOT NULL,
	"submitted_by" uuid,
	"workflow_state" text NOT NULL,
	"engine_submission_ref" text,
	"engine_sync_status" text NOT NULL,
	"engine_sync_error" text,
	"current_revision_no" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."integration_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."enterprise_group_binding" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"workspace_group_id" uuid NOT NULL,
	"provider_code" text NOT NULL,
	"external_group_id" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."enterprise_membership_binding" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"workspace_membership_id" uuid NOT NULL,
	"provider_code" text NOT NULL,
	"external_membership_id" text NOT NULL,
	"external_role" text,
	"provider_identity_type" text,
	"provider_identity_subject" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."enterprise_sync_cursor" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_code" text NOT NULL,
	"cursor_key" text NOT NULL,
	"cursor_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."enterprise_sync_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_code" text NOT NULL,
	"sync_type" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."enterprise_workspace_binding" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_code" text NOT NULL,
	"external_workspace_id" text NOT NULL,
	"status" text NOT NULL,
	"config" jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."personal_audit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."personal_invite" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"invitee_email" text NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"accepted_by_user_id" uuid,
	"invite_token_hash" text NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soba"."personal_workspace_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"default_landing_path" text,
	"preferences" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "soba"."app_user" ADD CONSTRAINT "app_user_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."app_user" ADD CONSTRAINT "app_user_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."identity_provider" ADD CONSTRAINT "identity_provider_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."identity_provider" ADD CONSTRAINT "identity_provider_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."user_identity" ADD CONSTRAINT "user_identity_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."user_identity" ADD CONSTRAINT "user_identity_identity_provider_id_identity_provider_id_fk" FOREIGN KEY ("identity_provider_id") REFERENCES "soba"."identity_provider"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."user_identity" ADD CONSTRAINT "user_identity_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."user_identity" ADD CONSTRAINT "user_identity_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_membership" ADD CONSTRAINT "workspace_group_membership_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_membership" ADD CONSTRAINT "workspace_group_membership_workspace_membership_id_workspace_membership_id_fk" FOREIGN KEY ("workspace_membership_id") REFERENCES "soba"."workspace_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_membership" ADD CONSTRAINT "workspace_group_membership_group_id_workspace_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "soba"."workspace_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_membership" ADD CONSTRAINT "workspace_group_membership_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group_membership" ADD CONSTRAINT "workspace_group_membership_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group" ADD CONSTRAINT "workspace_group_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group" ADD CONSTRAINT "workspace_group_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_group" ADD CONSTRAINT "workspace_group_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_membership" ADD CONSTRAINT "workspace_membership_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_membership" ADD CONSTRAINT "workspace_membership_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_membership" ADD CONSTRAINT "workspace_membership_invited_by_user_id_app_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_membership" ADD CONSTRAINT "workspace_membership_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace_membership" ADD CONSTRAINT "workspace_membership_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace" ADD CONSTRAINT "workspace_owner_user_id_app_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace" ADD CONSTRAINT "workspace_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."workspace" ADD CONSTRAINT "workspace_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form_version_revision" ADD CONSTRAINT "form_version_revision_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form_version_revision" ADD CONSTRAINT "form_version_revision_form_version_id_form_version_id_fk" FOREIGN KEY ("form_version_id") REFERENCES "soba"."form_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form_version_revision" ADD CONSTRAINT "form_version_revision_changed_by_app_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form_version" ADD CONSTRAINT "form_version_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form_version" ADD CONSTRAINT "form_version_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "soba"."form"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form_version" ADD CONSTRAINT "form_version_published_by_app_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form_version" ADD CONSTRAINT "form_version_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form_version" ADD CONSTRAINT "form_version_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form_version" ADD CONSTRAINT "form_version_deleted_by_app_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form" ADD CONSTRAINT "form_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form" ADD CONSTRAINT "form_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form" ADD CONSTRAINT "form_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."form" ADD CONSTRAINT "form_deleted_by_app_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission_revision" ADD CONSTRAINT "submission_revision_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission_revision" ADD CONSTRAINT "submission_revision_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "soba"."submission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission_revision" ADD CONSTRAINT "submission_revision_changed_by_app_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission" ADD CONSTRAINT "submission_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission" ADD CONSTRAINT "submission_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "soba"."form"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission" ADD CONSTRAINT "submission_form_version_id_form_version_id_fk" FOREIGN KEY ("form_version_id") REFERENCES "soba"."form_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission" ADD CONSTRAINT "submission_submitted_by_app_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission" ADD CONSTRAINT "submission_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission" ADD CONSTRAINT "submission_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."submission" ADD CONSTRAINT "submission_deleted_by_app_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."integration_outbox" ADD CONSTRAINT "integration_outbox_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."integration_outbox" ADD CONSTRAINT "integration_outbox_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."integration_outbox" ADD CONSTRAINT "integration_outbox_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_group_binding" ADD CONSTRAINT "enterprise_group_binding_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_group_binding" ADD CONSTRAINT "enterprise_group_binding_workspace_group_id_workspace_group_id_fk" FOREIGN KEY ("workspace_group_id") REFERENCES "soba"."workspace_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_group_binding" ADD CONSTRAINT "enterprise_group_binding_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_group_binding" ADD CONSTRAINT "enterprise_group_binding_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_membership_binding" ADD CONSTRAINT "enterprise_membership_binding_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_membership_binding" ADD CONSTRAINT "enterprise_membership_binding_workspace_membership_id_workspace_membership_id_fk" FOREIGN KEY ("workspace_membership_id") REFERENCES "soba"."workspace_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_membership_binding" ADD CONSTRAINT "enterprise_membership_binding_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_membership_binding" ADD CONSTRAINT "enterprise_membership_binding_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_sync_cursor" ADD CONSTRAINT "enterprise_sync_cursor_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_sync_cursor" ADD CONSTRAINT "enterprise_sync_cursor_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_sync_cursor" ADD CONSTRAINT "enterprise_sync_cursor_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_sync_log" ADD CONSTRAINT "enterprise_sync_log_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_sync_log" ADD CONSTRAINT "enterprise_sync_log_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_sync_log" ADD CONSTRAINT "enterprise_sync_log_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_workspace_binding" ADD CONSTRAINT "enterprise_workspace_binding_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_workspace_binding" ADD CONSTRAINT "enterprise_workspace_binding_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."enterprise_workspace_binding" ADD CONSTRAINT "enterprise_workspace_binding_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."personal_audit" ADD CONSTRAINT "personal_audit_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."personal_audit" ADD CONSTRAINT "personal_audit_actor_user_id_app_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."personal_audit" ADD CONSTRAINT "personal_audit_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."personal_audit" ADD CONSTRAINT "personal_audit_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."personal_invite" ADD CONSTRAINT "personal_invite_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."personal_invite" ADD CONSTRAINT "personal_invite_invited_by_user_id_app_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."personal_invite" ADD CONSTRAINT "personal_invite_accepted_by_user_id_app_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."personal_invite" ADD CONSTRAINT "personal_invite_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."personal_invite" ADD CONSTRAINT "personal_invite_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."personal_workspace_settings" ADD CONSTRAINT "personal_workspace_settings_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "soba"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."personal_workspace_settings" ADD CONSTRAINT "personal_workspace_settings_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."personal_workspace_settings" ADD CONSTRAINT "personal_workspace_settings_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "soba"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "identity_provider_code_uq" ON "soba"."identity_provider" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identity_provider_subject_uq" ON "soba"."user_identity" USING btree ("identity_provider_id","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identity_user_provider_uq" ON "soba"."user_identity" USING btree ("user_id","identity_provider_id");--> statement-breakpoint
CREATE INDEX "user_identity_user_idx" ON "soba"."user_identity" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_group_membership_uq" ON "soba"."workspace_group_membership" USING btree ("workspace_id","workspace_membership_id","group_id");--> statement-breakpoint
CREATE INDEX "workspace_group_membership_workspace_idx" ON "soba"."workspace_group_membership" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_group_membership_membership_idx" ON "soba"."workspace_group_membership" USING btree ("workspace_membership_id");--> statement-breakpoint
CREATE INDEX "workspace_group_membership_group_idx" ON "soba"."workspace_group_membership" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_group_workspace_name_uq" ON "soba"."workspace_group" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_group_workspace_external_uq" ON "soba"."workspace_group" USING btree ("workspace_id","external_group_id");--> statement-breakpoint
CREATE INDEX "workspace_group_workspace_idx" ON "soba"."workspace_group" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_membership_workspace_user_uq" ON "soba"."workspace_membership" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_membership_workspace_idx" ON "soba"."workspace_membership" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_membership_user_idx" ON "soba"."workspace_membership" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_slug_uq" ON "soba"."workspace" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "workspace_owner_idx" ON "soba"."workspace" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_version_revision_workspace_form_version_revision_uq" ON "soba"."form_version_revision" USING btree ("workspace_id","form_version_id","revision_no");--> statement-breakpoint
CREATE INDEX "form_version_revision_workspace_idx" ON "soba"."form_version_revision" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_version_workspace_form_version_uq" ON "soba"."form_version" USING btree ("workspace_id","form_id","version_no");--> statement-breakpoint
CREATE INDEX "form_version_workspace_idx" ON "soba"."form_version" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "form_version_form_idx" ON "soba"."form_version" USING btree ("form_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_workspace_slug_uq" ON "soba"."form" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "form_workspace_idx" ON "soba"."form" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_revision_workspace_submission_revision_uq" ON "soba"."submission_revision" USING btree ("workspace_id","submission_id","revision_no");--> statement-breakpoint
CREATE INDEX "submission_revision_workspace_idx" ON "soba"."submission_revision" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "submission_workspace_workflow_idx" ON "soba"."submission" USING btree ("workspace_id","workflow_state");--> statement-breakpoint
CREATE INDEX "submission_workspace_idx" ON "soba"."submission" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "submission_form_version_idx" ON "soba"."submission" USING btree ("form_version_id");--> statement-breakpoint
CREATE INDEX "integration_outbox_status_workspace_idx" ON "soba"."integration_outbox" USING btree ("status","workspace_id");--> statement-breakpoint
CREATE INDEX "integration_outbox_status_next_attempt_idx" ON "soba"."integration_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "integration_outbox_aggregate_idx" ON "soba"."integration_outbox" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_group_binding_provider_group_uq" ON "soba"."enterprise_group_binding" USING btree ("provider_code","external_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_group_binding_workspace_group_uq" ON "soba"."enterprise_group_binding" USING btree ("workspace_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_membership_binding_provider_membership_uq" ON "soba"."enterprise_membership_binding" USING btree ("provider_code","external_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_membership_binding_workspace_membership_uq" ON "soba"."enterprise_membership_binding" USING btree ("workspace_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_membership_binding_workspace_identity_uq" ON "soba"."enterprise_membership_binding" USING btree ("workspace_id","provider_identity_type","provider_identity_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_sync_cursor_workspace_cursor_uq" ON "soba"."enterprise_sync_cursor" USING btree ("workspace_id","provider_code","cursor_key");--> statement-breakpoint
CREATE INDEX "enterprise_sync_log_workspace_started_idx" ON "soba"."enterprise_sync_log" USING btree ("workspace_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_workspace_binding_provider_external_uq" ON "soba"."enterprise_workspace_binding" USING btree ("provider_code","external_workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_workspace_binding_workspace_provider_uq" ON "soba"."enterprise_workspace_binding" USING btree ("workspace_id","provider_code");--> statement-breakpoint
CREATE INDEX "personal_audit_workspace_occurred_idx" ON "soba"."personal_audit" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_invite_token_uq" ON "soba"."personal_invite" USING btree ("invite_token_hash");--> statement-breakpoint
CREATE INDEX "personal_invite_workspace_invitee_status_idx" ON "soba"."personal_invite" USING btree ("workspace_id","invitee_email","status");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_workspace_settings_workspace_uq" ON "soba"."personal_workspace_settings" USING btree ("workspace_id");