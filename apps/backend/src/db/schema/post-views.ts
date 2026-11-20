import { pgTable, uuid, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { posts } from "./posts.js";

export const postViews = pgTable(
  "post_views",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    // "u:<userId>" для вошедших, "g:<хеш IP+UA>" для гостей
    viewerKey: text("viewer_key").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.viewerKey] })]
);