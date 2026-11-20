import { createHmac, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";

// Запасной секрет на случай, если переменные окружения не заданы (тесты, dev):
// при перезапуске гости посчитаются заново, но ничего не сломается.
const FALLBACK_SECRET = randomBytes(32).toString("hex");

const secret = () => process.env.VIEW_HASH_SECRET || process.env.JWT_SECRET || FALLBACK_SECRET;

/** Ключ зрителя: пользователь по id, гость по обезличенному хешу IP + User-Agent. */
export function viewerKeyFor(request: FastifyRequest, viewerId: string | null): string {
  if (viewerId) return `u:${viewerId}`;
  const ua = String(request.headers["user-agent"] ?? "");
  const hash = createHmac("sha256", secret())
    .update(`${request.ip}|${ua}`)
    .digest("hex")
    .slice(0, 32);
  return `g:${hash}`;
}