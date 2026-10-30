import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, type UserRole } from "../db/schema/index.js";

declare module "fastify" {
  interface FastifyRequest {
    staffRole?: UserRole;
  }
}

const RANK: Record<UserRole, number> = { user: 0, moderator: 1, admin: 2 };

export function requireRole(min: Exclude<UserRole, "user">) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sub = (request.user as { sub?: string } | undefined)?.sub;
    if (!sub) return reply.code(401).send({ error: "Требуется авторизация" });

    const [row] = await db
      .select({ role: users.role, deletedAt: users.deletedAt, bannedAt: users.bannedAt })
      .from(users)
      .where(eq(users.id, sub));

    if (!row || row.deletedAt || row.bannedAt || RANK[row.role] < RANK[min]) {
      return reply.code(403).send({ error: "Недостаточно прав" });
    }
    request.staffRole = row.role;
  };
}