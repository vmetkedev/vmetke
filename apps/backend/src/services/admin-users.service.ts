import { and, count, desc, eq, ilike, isNotNull, isNull, max, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  users,
  posts,
  comments,
  refreshTokens,
  adminAuditLog,
  type UserRole,
} from "../db/schema/index.js";

export class AdminActionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listUsers(params: {
  q?: string;
  role?: UserRole;
  banned?: boolean;
  cursor?: string;
  limit: number;
}) {
  const conditions = [isNull(users.deletedAt)];
  if (params.q) {
    const pattern = `%${escapeLike(params.q)}%`;
    conditions.push(or(ilike(users.username, pattern), ilike(users.email, pattern))!);
  }
  if (params.role) conditions.push(eq(users.role, params.role));
  if (params.banned === true) conditions.push(isNotNull(users.bannedAt));
  if (params.banned === false) conditions.push(isNull(users.bannedAt));
  if (params.cursor) {
    // Курсор это id последней строки. Сравнение идёт по её created_at в самой БД:
    // так не теряется микросекундная точность, которой нет у JS Date.
    conditions.push(
      sql`(${users.createdAt}, ${users.id}) < (select created_at, id from users where id = ${params.cursor})`,
    );
  }

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      avatarColor: users.avatarColor,
      createdAt: users.createdAt,
      bannedAt: users.bannedAt,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  const items = hasMore ? rows.slice(0, params.limit) : rows;
  return { users: items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export async function getUserDetail(id: string) {
  const [u] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      displayName: users.displayName,
      bio: users.bio,
      role: users.role,
      avatarColor: users.avatarColor,
      createdAt: users.createdAt,
      bannedAt: users.bannedAt,
      banReason: users.banReason,
    })
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)));
  if (!u) return null;

  const [[p], [c], [t]] = await Promise.all([
    db.select({ n: count() }).from(posts).where(eq(posts.authorId, id)),
    db.select({ n: count() }).from(comments).where(eq(comments.authorId, id)),
    db.select({ last: max(refreshTokens.createdAt) }).from(refreshTokens).where(eq(refreshTokens.userId, id)),
  ]);

  return {
    ...u,
    postsCount: p.n,
    commentsCount: c.n,
    // Последняя выдача refresh-токена (вход или ротация)
    lastActiveAt: t.last,
  };
}

async function loadTarget(tx: Tx, id: string) {
  const [t] = await tx
    .select({ id: users.id, username: users.username, role: users.role, bannedAt: users.bannedAt })
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)));
  if (!t) throw new AdminActionError(404, "Пользователь не найден");
  return t;
}

// Страховка: через API до этого не дойти (себя трогать нельзя, а действующий админ всегда
// есть среди остальных), но одновременные понижения или баны двух админов друг друга
// без неё могли бы оставить систему без админа.
async function assertNotLastAdmin(tx: Tx, target: { role: UserRole; bannedAt: Date | null }) {
  if (target.role !== "admin" || target.bannedAt) return;
  const [{ n }] = await tx
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), isNull(users.bannedAt), isNull(users.deletedAt)));
  if (n <= 1) throw new AdminActionError(409, "Нельзя лишить доступа последнего администратора");
}

export async function banUser(adminId: string, targetId: string, reason: string) {
  if (adminId === targetId) throw new AdminActionError(400, "Нельзя заблокировать себя");

  await db.transaction(async (tx) => {
    const t = await loadTarget(tx, targetId);
    if (t.bannedAt) throw new AdminActionError(409, "Пользователь уже заблокирован");
    await assertNotLastAdmin(tx, t);

    await tx.update(users).set({ bannedAt: new Date(), banReason: reason }).where(eq(users.id, targetId));
    await tx.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.userId, targetId));
    await tx.insert(adminAuditLog).values({
      adminId,
      action: "user.ban",
      targetType: "user",
      targetId,
      details: { username: t.username, reason },
    });
  });
}

export async function unbanUser(adminId: string, targetId: string) {
  await db.transaction(async (tx) => {
    const t = await loadTarget(tx, targetId);
    if (!t.bannedAt) throw new AdminActionError(409, "Пользователь не заблокирован");

    await tx.update(users).set({ bannedAt: null, banReason: null }).where(eq(users.id, targetId));
    await tx.insert(adminAuditLog).values({
      adminId,
      action: "user.unban",
      targetType: "user",
      targetId,
      details: { username: t.username },
    });
  });
}

export async function changeRole(adminId: string, targetId: string, role: UserRole) {
  if (adminId === targetId) throw new AdminActionError(400, "Нельзя изменить свою роль");

  await db.transaction(async (tx) => {
    const t = await loadTarget(tx, targetId);
    if (t.role === role) throw new AdminActionError(409, "У пользователя уже эта роль");
    if (t.role === "admin") await assertNotLastAdmin(tx, t);

    await tx.update(users).set({ role }).where(eq(users.id, targetId));
    await tx.insert(adminAuditLog).values({
      adminId,
      action: "role.change",
      targetType: "user",
      targetId,
      details: { username: t.username, previousRole: t.role, role },
    });
  });
}

export async function forceLogout(adminId: string, targetId: string) {
  await db.transaction(async (tx) => {
    const t = await loadTarget(tx, targetId);
    await tx.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.userId, targetId));
    await tx.insert(adminAuditLog).values({
      adminId,
      action: "user.force_logout",
      targetType: "user",
      targetId,
      details: { username: t.username },
    });
  });
}