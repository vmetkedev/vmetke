import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const reportTargetEnum = pgEnum("report_target_type", ["post", "comment", "user", "message"]);
export const reportReasonEnum = pgEnum("report_reason", ["spam", "abuse", "illegal", "other"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "resolved", "dismissed"]);

export type ReportTargetType = (typeof reportTargetEnum.enumValues)[number];
export type ReportReason = (typeof reportReasonEnum.enumValues)[number];
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    targetType: reportTargetEnum("target_type").notNull(),
    // uuid поста, комментария или пользователя; id сообщения (число) строкой
    targetId: varchar("target_id", { length: 64 }).notNull(),
    // Автор или владелец объекта жалобы: нужен для «забанить автора», даже если контент уже удалён
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    reason: reportReasonEnum("reason").notNull(),
    comment: varchar("comment", { length: 500 }),
    status: reportStatusEnum("status").notNull().default("open"),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at"),
    resolutionAction: varchar("resolution_action", { length: 32 }),
    resolutionReason: varchar("resolution_reason", { length: 500 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // Один открытый репорт на пару «жалобщик + цель»
    uniqueIndex("reports_open_unique")
      .on(t.reporterId, t.targetType, t.targetId)
      .where(sql`${t.status} = 'open'`),
    index("reports_status_created_idx").on(t.status, t.createdAt),
    index("reports_target_idx").on(t.targetType, t.targetId),
  ],
);