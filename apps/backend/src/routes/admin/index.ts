import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/roles.js";
import { getAdminStats } from "../../services/admin-stats.service.js";
import adminUsersRoutes from "./users.js";
import adminContentRoutes from "./content.js";

export default async function adminRoutes(app: FastifyInstance) {
  // Хуки на уровне плагина: любой будущий роут внутри защищён автоматически
  app.addHook("onRequest", app.authenticate);
  app.addHook("onRequest", requireRole("moderator"));

  // Базовый минимум staff; админские роуты (7.4+) добавят preHandler: [requireRole("admin")]
  app.get("/whoami", async (request) => ({ role: request.staffRole }));
  app.get("/stats", async () => getAdminStats());
  
  await app.register(adminUsersRoutes, { prefix: "/users" });
  await app.register(adminContentRoutes, { prefix: "/content" });
}