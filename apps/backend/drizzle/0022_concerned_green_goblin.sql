CREATE TYPE "public"."report_reason" AS ENUM('spam', 'abuse', 'illegal', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target_type" AS ENUM('post', 'comment', 'user', 'message');--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"target_type" "report_target_type" NOT NULL,
	"target_id" varchar(64) NOT NULL,
	"target_user_id" uuid,
	"reason" "report_reason" NOT NULL,
	"comment" varchar(500),
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"resolution_action" varchar(32),
	"resolution_reason" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_unique" ON "reports" USING btree ("reporter_id","target_type","target_id") WHERE "reports"."status" = 'open';--> statement-breakpoint
CREATE INDEX "reports_status_created_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");