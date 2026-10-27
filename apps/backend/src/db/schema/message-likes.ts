import { integer, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { messages } from "./messages.js";
import { users } from "./users.js";

export const messageLikes = pgTable(
  "message_likes",
  {
    messageId: integer("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId] })],
);