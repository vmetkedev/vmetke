import type { FastifyInstance } from "fastify";
import { registerSchema, loginSchema } from "../schemas/auth.js";
import {
  registerUser,
  validateCredentials,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../services/auth.service.js";

import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema/index.js";

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth",
  maxAge: 30 * 24 * 60 * 60,
};

export default async function authRoutes(app: FastifyInstance) {
  app.post(
    "/register",
    { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const user = await registerUser(parsed.data);
      const accessToken = app.jwt.sign({ sub: user.id });
      const refreshToken = await createRefreshToken(user.id);

      reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
      return { accessToken, user: { id: user.id, username: user.username } };
  });

  app.post(
    "/login",
    { config: { rateLimit: { max: 8, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const user = await validateCredentials(parsed.data);
      if (!user) {
        return reply.code(401).send({ error: "Неверные данные для входа" });
      }

      const accessToken = app.jwt.sign({ sub: user.id });
      const refreshToken = await createRefreshToken(user.id);

      reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
      return { accessToken, user: { id: user.id, username: user.username } };
  });

  app.post("/refresh", async (request, reply) => {
    const rawToken = request.cookies[REFRESH_COOKIE_NAME];
    if (!rawToken) return reply.code(401).send({ error: "No refresh token" });

    const result = await rotateRefreshToken(rawToken);
    if (!result) return reply.code(401).send({ error: "Invalid refresh token" });

    const accessToken = app.jwt.sign({ sub: result.userId });
    reply.setCookie(REFRESH_COOKIE_NAME, result.token, REFRESH_COOKIE_OPTIONS);
    return { accessToken };
  });

  app.post("/logout", async (request, reply) => {
    const rawToken = request.cookies[REFRESH_COOKIE_NAME];
    if (rawToken) await revokeRefreshToken(rawToken);
    reply.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    return { success: true };
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request) => {
    const payload = request.user as { sub: string };
    const [user] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, payload.sub));

    return { user: user ?? null };
  });
}