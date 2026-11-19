import type { FastifyInstance } from "fastify";
import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import { getPostById } from "../services/posts.service.js";
import { buildNotFoundHead, buildPostHead, injectHead } from "../lib/seo.js";

const SITE_URL = "https://vmetke.ru";
const postIdSchema = z.string().uuid();

const indexPath = () =>
  process.env.FRONTEND_INDEX_PATH ?? "/var/www/vmetke/frontend/dist/index.html";

let cache: { path: string; mtimeMs: number; html: string } | null = null;

// После деплоя index.html меняется (новые хэши ассетов), поэтому перечитываем по mtime
async function loadTemplate(): Promise<string | null> {
  const path = indexPath();
  try {
    const { mtimeMs } = await stat(path);
    if (!cache || cache.path !== path || cache.mtimeMs !== mtimeMs) {
      cache = { path, mtimeMs, html: await readFile(path, "utf8") };
    }
    return cache.html;
  } catch {
    return null;
  }
}

// Эти заголовки helmet ставит на все ответы. Nginx их для SPA не отдаёт,
// а CSP по умолчанию запретит внешние картинки в постах.
const STRIPPED_HEADERS = ["content-security-policy", "cross-origin-opener-policy"];

export default async function seoRoutes(app: FastifyInstance) {
  app.get<{ Params: { postId: string } }>(
    "/post/:postId",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const template = await loadTemplate();
      // 503: Nginx перехватит и отдаст обычный index.html
      if (!template) return reply.code(503).send("index.html unavailable");

      for (const name of STRIPPED_HEADERS) {
        reply.removeHeader(name);
        reply.raw.removeHeader(name);
      }
      reply.header("content-type", "text/html; charset=utf-8");
      reply.header("cache-control", "no-cache");

      const parsed = postIdSchema.safeParse(request.params.postId);
      // countView=false: боты и превью в мессенджерах не накручивают просмотры
      const post = parsed.success ? await getPostById(parsed.data, null, false) : null;

      if (!post) return reply.code(404).send(injectHead(template, buildNotFoundHead()));
      return reply.send(injectHead(template, buildPostHead(post, SITE_URL)));
    }
  );
}