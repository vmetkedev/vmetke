import type { OutgoingHttpHeaders } from "node:http";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { addClient, closeAllClients } from "../services/realtime.service.js";

export default async function eventsRoutes(app: FastifyInstance) {
  app.addHook("onClose", async () => {
    closeAllClients();
  });

  // Тот же приём, что в messages.ts: onRequest rate-limit срабатывает раньше authenticate
  const userKey = (request: FastifyRequest) => {
    try {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (token) return `user:${app.jwt.verify<{ sub: string }>(token).sub}`;
    } catch {
      // невалидный токен: authenticate вернёт 401
    }
    return request.ip;
  };

  app.get(
    "/",
    {
      preHandler: [app.authenticate],
      // защита от цикла переподключений на клиенте
      config: { rateLimit: { max: 30, timeWindow: "1 minute", keyGenerator: userKey } },
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;

      // hijack: дальше пишем в сокет сами, поэтому заголовки (CORS, helmet) берём из reply
      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        ...(reply.getHeaders() as OutgoingHttpHeaders),
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      res.write(": connected\n\n");

      const remove = addClient(userId, res);
      request.raw.on("close", remove);
      return reply;
    },
  );
}