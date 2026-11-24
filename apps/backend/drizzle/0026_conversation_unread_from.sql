ALTER TABLE "conversations" ADD COLUMN "unread_from_low_id" integer;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "unread_from_high_id" integer;--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN "marked_unread_low";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN "marked_unread_high";