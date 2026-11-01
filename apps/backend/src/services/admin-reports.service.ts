import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/client.js";
import {
  adminAuditLog,
  comments,
  posts,
  reports,
  users,
  type ReportStatus,
  type ReportTargetType,
} from "../db/schema/index.js";
import { AdminActionError, banUser } from "./admin-users.service.js";
import { deleteComment, deletePost, type Actor } from "./admin-content.service.js";

export type ReportAction = "delete_content" | "ban_author" | "dismiss";

export async function listReports(p: {
  status: ReportStatus | "all";
  targetType?: ReportTargetType;
  cursor?: string;
  limit: number;
}) {
  const reporter = alias(users, "reporter");
  const targetUser = alias(users, "target_user");

  const conditions: SQL[] = [];
  if (p.status !== "all") conditions.push(eq(reports.status, p.status));
  if (p.targetType) conditions.push(eq(reports.targetType, p.targetType));
  if (p.cursor) {
    conditions.push(
      sql`(${reports.createdAt}, ${reports.id}) < (select created_at, id from reports where id = ${p.cursor})`,
    );
  }

  const rows = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      comment: reports.comment,
      status: reports.status,
      createdAt: reports.createdAt,
      // Короткий предпросмотр; полный снимок только в карточке жалобы
      preview: sql<string>`left(coalesce(${reports.snapshot}->>'content', ${reports.snapshot}->'message'->>'content', ${reports.snapshot}->>'bio', ''), 200)`,
      reporter: { id: reporter.id, username: reporter.username },
      targetUser: { id: targetUser.id, username: targetUser.username, role: targetUser.role },
    })
    .from(reports)
    .leftJoin(reporter, eq(reports.reporterId, reporter.id))
    .leftJoin(targetUser, eq(reports.targetUserId, targetUser.id))
    .where(and(...conditions))
    .orderBy(desc(reports.createdAt), desc(reports.id))
    .limit(p.limit + 1);

  const hasMore = rows.length > p.limit;
  const items = hasMore ? rows.slice(0, p.limit) : rows;
  return { reports: items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

async function contentExists(type: ReportTargetType, id: string) {
  if (type === "post") {
    const [r] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, id));
    return !!r;
  }
  if (type === "comment") {
    const [r] = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, id));
    return !!r;
  }
  return false; // для user и message удалять нечего
}

export async function getReportDetail(id: string) {
  const reporter = alias(users, "reporter");
  const targetUser = alias(users, "target_user");
  const resolver = alias(users, "resolver");

  const [row] = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      comment: reports.comment,
      status: reports.status,
      snapshot: reports.snapshot,
      createdAt: reports.createdAt,
      resolvedAt: reports.resolvedAt,
      resolutionAction: reports.resolutionAction,
      resolutionReason: reports.resolutionReason,
      reporter: { id: reporter.id, username: reporter.username },
      targetUser: {
        id: targetUser.id,
        username: targetUser.username,
        role: targetUser.role,
        bannedAt: targetUser.bannedAt,
        deletedAt: targetUser.deletedAt,
      },
      resolvedBy: { id: resolver.id, username: resolver.username },
    })
    .from(reports)
    .leftJoin(reporter, eq(reports.reporterId, reporter.id))
    .leftJoin(targetUser, eq(reports.targetUserId, targetUser.id))
    .leftJoin(resolver, eq(reports.resolvedBy, resolver.id))
    .where(eq(reports.id, id));
  if (!row) return null;

  const [{ n }] = await db
    .select({ n: count() })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, row.targetType),
        eq(reports.targetId, row.targetId),
        eq(reports.status, "open"),
      ),
    );

  return {
    ...row,
    openReportsForTarget: n,
    contentExists: await contentExists(row.targetType, row.targetId),
  };
}

export async function resolveReport(
  actor: Actor,
  reportId: string,
  input: { action: ReportAction; reason?: string },
) {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId));
  if (!report) throw new AdminActionError(404, "Жалоба не найдена");
  if (report.status !== "open") throw new AdminActionError(409, "Жалоба уже обработана");

  const { action, reason } = input;

  if (action === "delete_content") {
    // Правила прав (модератор не трогает чужих модераторов и админов) проверяют сервисы удаления
    if (report.targetType === "post") await deletePost(actor, report.targetId, reason!);
    else if (report.targetType === "comment") await deleteComment(actor, report.targetId, reason!);
    else throw new AdminActionError(400, "Для этой жалобы нельзя удалить контент");
  } else if (action === "ban_author") {
    if (actor.role !== "admin") {
      throw new AdminActionError(403, "Блокировать пользователей может только администратор");
    }
    if (!report.targetUserId) throw new AdminActionError(409, "Автор не найден");
    const [author] = await db
      .select({ bannedAt: users.bannedAt, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, report.targetUserId));
    if (!author || author.deletedAt) throw new AdminActionError(409, "Автор не найден");
    // Уже заблокирован: просто закрываем жалобу
    if (!author.bannedAt) await banUser(actor.id, report.targetUserId, reason!);
  }

  const status: ReportStatus = action === "dismiss" ? "dismissed" : "resolved";
  const resolutionAction = { delete_content: "content_deleted", ban_author: "author_banned", dismiss: "dismissed" }[action];

  return db.transaction(async (tx) => {
    // Удаление контента закрывает все открытые жалобы на этот объект, остальные действия только эту
    const where =
      action === "delete_content"
        ? and(
            eq(reports.status, "open"),
            eq(reports.targetType, report.targetType),
            eq(reports.targetId, report.targetId),
          )
        : and(eq(reports.id, reportId), eq(reports.status, "open"));

    const updated = await tx
      .update(reports)
      .set({
        status,
        resolvedBy: actor.id,
        resolvedAt: new Date(),
        resolutionAction,
        resolutionReason: reason || null,
      })
      .where(where)
      .returning({ id: reports.id });
    if (updated.length === 0) throw new AdminActionError(409, "Жалоба уже обработана");

    await tx.insert(adminAuditLog).values({
      adminId: actor.id,
      action: action === "dismiss" ? "report.dismiss" : "report.resolve",
      targetType: "report",
      targetId: reportId,
      details: {
        resolution: resolutionAction,
        reason: reason || null,
        reportedType: report.targetType,
        reportedId: report.targetId,
        resolvedReportIds: updated.map((u) => u.id),
      },
    });
    return { resolvedIds: updated.map((u) => u.id) };
  });
}