import type { FastifyInstance } from "fastify";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const fromEnv = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** Лимит для действий с подтверждением паролем: защита от подбора. По умолчанию 5 за 10 минут. */
export function sensitiveRateLimit() {
  return { max: fromEnv("ADMIN_RATE_LIMIT_SENSITIVE", 5), timeWindow: "10 minutes" };
}

/**
 * Строгий лимит на все роуты /api/admin/*.
 *
 * Вызывать на корневом инстансе ДО регистрации @fastify/rate-limit:
 * плагин читает config.rateLimit в своём onRoute-хуке, а хуки корня идут
 * в порядке регистрации. Роут со своим config.rateLimit (sensitiveRateLimit) не перетирается.
 * Чтение: ADMIN_RATE_LIMIT_READ (по умолчанию 120/мин),
 * изменение: ADMIN_RATE_LIMIT_WRITE (по умолчанию 30/мин).
 */
export function applyAdminRateLimit(app: FastifyInstance) {
  const read = fromEnv("ADMIN_RATE_LIMIT_READ", 120);
  const write = fromEnv("ADMIN_RATE_LIMIT_WRITE", 30);

  app.addHook("onRoute", (route) => {
    if (!route.url.startsWith("/api/admin")) return;
    const config = (route.config ?? {}) as { rateLimit?: unknown };
    if (config.rateLimit) return;
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    const max = methods.some((m) => MUTATING.has(m)) ? write : read;
    route.config = { ...config, rateLimit: { max, timeWindow: "1 minute" } } as typeof route.config;
  });
}