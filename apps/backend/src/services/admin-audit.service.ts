import { and, desc, eq, gte, ilike, lt, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminAuditLog, users } from "../db/schema/index.js";

export type AuditListParams = {
  admin?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: string; // YYYY-MM-DD, включительно, UTC
  to?: string; // YYYY-MM-DD, включительно, UTC
  cursor?: number;
  limit: number;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const dayStart = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dayAfter = (d: string) => {
  const x = dayStart(d);
  x.setUTCDate(x.getUTCDate() + 1);
  return x;
};

export async function listAuditLog(p: AuditListParams) {
  const conditions: SQL[] = [];
  if (p.admin) conditions.push(ilike(users.username, escapeLike(p.admin)));
  if (p.action) conditions.push(eq(adminAuditLog.action, p.action));
  if (p.targetType) conditions.push(eq(adminAuditLog.targetType, p.targetType));
  if (p.targetId) conditions.push(eq(adminAuditLog.targetId, p.targetId));
  if (p.from) conditions.push(gte(adminAuditLog.createdAt, dayStart(p.from)));
  if (p.to) conditions.push(lt(adminAuditLog.createdAt, dayAfter(p.to)));
  if (p.cursor) conditions.push(lt(adminAuditLog.id, p.cursor));

  const rows = await db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      targetType: adminAuditLog.targetType,
      targetId: adminAuditLog.targetId,
      createdAt: adminAuditLog.createdAt,
      admin: { id: users.id, username: users.username },
      // Только короткие поля; полный details отдаётся карточкой записи
      reason: sql<string | null>`${adminAuditLog.details}->>'reason'`,
      targetLabel: sql<string | null>`coalesce(${adminAuditLog.details}->>'username', ${adminAuditLog.details}->'snapshot'->>'authorUsername')`,
    })
    .from(adminAuditLog)
    .leftJoin(users, eq(adminAuditLog.adminId, users.id))
    .where(and(...conditions))
    .orderBy(desc(adminAuditLog.id))
    .limit(p.limit + 1);

  const hasMore = rows.length > p.limit;
  const items = hasMore ? rows.slice(0, p.limit) : rows;
  return { entries: items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export async function getAuditEntry(id: number) {
  const [row] = await db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      targetType: adminAuditLog.targetType,
      targetId: adminAuditLog.targetId,
      details: adminAuditLog.details,
      createdAt: adminAuditLog.createdAt,
      admin: { id: users.id, username: users.username },
    })
    .from(adminAuditLog)
    .leftJoin(users, eq(adminAuditLog.adminId, users.id))
    .where(eq(adminAuditLog.id, id));
  return row ?? null;
}