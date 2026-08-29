import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { posts } from "./posts.js";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["like", "comment", "follow"] }).notNull(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});