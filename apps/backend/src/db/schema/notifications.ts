import { pgTable, uuid, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { posts } from "./posts.js";

export type ModerationDetails = {
  action: "post_deleted" | "comment_deleted";
  title: string | null; // заголовок поста или начало комментария
  reason: string;
};

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // null у уведомлений от модерации: модератор автору не раскрывается
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["like", "comment", "follow", "moderation"] }).notNull(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
  details: jsonb("details").$type<ModerationDetails>(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});