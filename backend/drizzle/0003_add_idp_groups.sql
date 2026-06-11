CREATE TABLE "soba"."idp_group" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'core' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "soba"."idp_group_member" (
	"group_code" text NOT NULL,
	"identity_provider_code" text NOT NULL,
	CONSTRAINT "idp_group_member_group_code_identity_provider_code_pk" PRIMARY KEY("group_code","identity_provider_code")
);
--> statement-breakpoint
ALTER TABLE "soba"."idp_group_member" ADD CONSTRAINT "idp_group_member_group_code_idp_group_code_fk" FOREIGN KEY ("group_code") REFERENCES "soba"."idp_group"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soba"."idp_group_member" ADD CONSTRAINT "idp_group_member_identity_provider_code_identity_provider_code_fk" FOREIGN KEY ("identity_provider_code") REFERENCES "soba"."identity_provider"("code") ON DELETE no action ON UPDATE no action;
