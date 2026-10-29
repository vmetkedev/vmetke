import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, adminAuditLog, type UserRole } from "../db/schema/index.js";

export async function logAdminAction(entry: {
  adminId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  await db.insert(adminAuditLog).values({
    adminId: entry.adminId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    details: entry.details ?? null,
  });
}

/** Назначает роль и пишет в журнал в одной транзакции. null, если пользователя нет. */
export async function grantRole(username: string, role: UserRole, adminId: string | null = null) {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.username, username));
    if (!target) return null;

    await tx.update(users).set({ role }).where(eq(users.id, target.id));
    await tx.insert(adminAuditLog).values({
      adminId,
      action: "role.grant",
      targetType: "user",
      targetId: target.id,
      details: { previousRole: target.role, role, via: adminId ? "api" : "cli" },
    });
    return { id: target.id, username: target.username, previousRole: target.role, role };
  });
}