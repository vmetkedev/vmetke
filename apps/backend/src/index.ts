import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import jwtPlugin from "./plugins/jwt";
import authRoutes from "./routes/auth";

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