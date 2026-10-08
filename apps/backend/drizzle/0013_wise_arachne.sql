ALTER TABLE "conversations" DROP CONSTRAINT "conversations_pair_unique";--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "cleared_low_id" integer;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "cleared_high_id" integer;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_pair_active_unique" ON "conversations" USING btree ("user_low_id","user_high_id") WHERE "conversations"."deleted_at" IS NULL;