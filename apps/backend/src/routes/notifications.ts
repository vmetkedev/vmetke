import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  deleteNotification,
} from "../services/notifications.service.js";

const idParamSchema = z.object({ id: z.string().uuid() });

export default async function notificationsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.authenticate] }, async (request) => {
    const payload = request.user as { sub: string };
    const [notifications, unreadCount] = await Promise.all([
      getNotifications(payload.sub),
      getUnreadCount(payload.sub),
    ]);
    return { notifications, unreadCount };
  });

  app.post("/read", { preHandler: [app.authenticate] }, async (request) => {
    const payload = request.user as { sub: string };
    await markAllRead(payload.sub);
    return { success: true };
  });

  app.delete("/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID уведомления" });

    const payload = request.user as { sub: string };
    await deleteNotification(parsed.data.id, payload.sub);
    return { success: true };
  });
}