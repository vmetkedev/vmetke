import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    // Пара пользователей хранится упорядоченно: low < high
    userLowId: uuid("user_low_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userHighId: uuid("user_high_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageId: integer("last_message_id"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastReadLowId: integer("last_read_low_id"),
    lastReadHighId: integer("last_read_high_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("conversations_pair_unique").on(t.userLowId, t.userHighId),
    check("conversations_order_check", sql`${t.userLowId} < ${t.userHighId}`),
    index("conversations_low_last_idx").on(t.userLowId, t.lastMessageAt),
    index("conversations_high_last_idx").on(t.userHighId, t.lastMessageAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_id_idx").on(t.conversationId, t.id)],
);