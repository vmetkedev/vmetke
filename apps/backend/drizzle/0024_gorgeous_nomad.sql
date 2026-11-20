CREATE TABLE "post_views" (
	"post_id" uuid NOT NULL,
	"viewer_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_views_post_id_viewer_key_pk" PRIMARY KEY("post_id","viewer_key")
);
--> statement-breakpoint
ALTER TABLE "post_views" ADD CONSTRAINT "post_views_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;