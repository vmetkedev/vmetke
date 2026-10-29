import { pgTable, serial, uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  // set null: журнал переживает удаление админа; null также у действий из CLI
  adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("target_type", { length: 32 }).notNull(),
  targetId: varchar("target_id", { length: 64 }),
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});