import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema/index.js";

export default fp(async (app: FastifyInstance) => {
  app.register(fastifyJwt, {
    secret: process.env.JWT_ACCESS_SECRET!,
    sign: { expiresIn: "15m" },
  });

  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const sub = (request.user as { sub?: string }).sub;
      if (!sub) return reply.code(401).send({ error: "Unauthorized" });

      // Бан действует сразу, не дожидаясь истечения access-токена.
      // 401 (а не 403), чтобы клиент пошёл на refresh, получил отказ и разлогинил пользователя.
      const [row] = await db
        .select({ bannedAt: users.bannedAt })
        .from(users)
        .where(eq(users.id, sub));
      if (row?.bannedAt) {
        return reply.code(401).send({ error: "Аккаунт заблокирован" });
      }
    },
  );

  app.decorate(
    "optionalAuthenticate",
    async (request: FastifyRequest) => {
      try {
        await request.jwtVerify();
      } catch {
        // не авторизован — это нормально, просто request.user останется пустым
      }
    }
  );
});