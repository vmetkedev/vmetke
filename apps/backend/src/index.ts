import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import jwtPlugin from "./plugins/jwt.js";
import authRoutes from "./routes/auth.js";
import postsRoutes from "./routes/posts.js";
import followsRoutes from "./routes/follows.js";
import usersRoutes from "./routes/users.js";
import notificationsRoutes from "./routes/notifications.js";
import searchRoutes from "./routes/search.js";

const app = Fastify({ logger: true });

const start = async () => {
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.NODE_ENV === "production" ? "https://vmetke.ru" : true,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(jwtPlugin);
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  await app.register(authRoutes, { prefix: "/api/auth" });

  await app.register(postsRoutes, { prefix: "/api/posts" });
  await app.register(followsRoutes, { prefix: "/api/follows" });
  await app.register(usersRoutes, { prefix: "/api/users" });
  await app.register(notificationsRoutes, { prefix: "/api/notifications" });
  await app.register(searchRoutes, { prefix: "/api/search" });

  app.get("/health", async () => ({ status: "ok" }));

  try {
    await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: "0.0.0.0",
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();