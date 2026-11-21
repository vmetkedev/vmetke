import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTestApp } from "./app.js";

const TEMPLATE =
  '<!doctype html><html lang="ru"><head><title>Vmetke.ru</title>' +
  '<meta name="description" content="def" data-seo-default /></head>' +
  '<body><div id="root"></div></body></html>';

let dir: string;
const prevPath = process.env.FRONTEND_INDEX_PATH;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "vmetke-seo-"));
  const file = join(dir, "index.html");
  await writeFile(file, TEMPLATE);
  process.env.FRONTEND_INDEX_PATH = file;
});

afterAll(async () => {
  if (prevPath === undefined) delete process.env.FRONTEND_INDEX_PATH;
  else process.env.FRONTEND_INDEX_PATH = prevPath;
  await rm(dir, { recursive: true, force: true });
});

async function registerAndLogin(app: FastifyInstance, username: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: `${username}@test.com`, password: "Passw0rd!", username },
  });
  return res.json().accessToken as string;
}

function userIdFromToken(token: string) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub as string;
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe("seo routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("страница поста содержит мета-теги и не накручивает просмотры", async () => {
    const token = await registerAndLogin(app, "seoauthor");
    const created = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: auth(token),
      payload: { title: "Заголовок для SEO", content: "Текст поста для проверки мета-тегов", tags: [] },
    });
    expect(created.statusCode).toBe(201);
    const postId = created.json().post.id as string;

    const page = await app.inject({ method: "GET", url: `/post/${postId}` });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain("<title>Заголовок для SEO | Vmetke.ru</title>");
    expect(page.body).toContain(`rel="canonical" href="https://vmetke.ru/post/${postId}"`);

    // страница для краулера не считается просмотром: первый реальный просмотр даёт 1
    const api = await app.inject({ method: "GET", url: `/api/posts/${postId}` });
    expect(api.json().post.viewsCount).toBe(1);
  });

  it("несуществующий пост даёт 404 и noindex", async () => {
    const res = await app.inject({ method: "GET", url: "/post/00000000-0000-4000-8000-000000000000" });
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain("noindex");
  });

  it("профиль отдаёт мета-теги", async () => {
    await registerAndLogin(app, "seoprofile");
    const res = await app.inject({ method: "GET", url: "/u/seoprofile" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("<title>@seoprofile | Vmetke.ru</title>");
    expect(res.body).toContain('rel="canonical" href="https://vmetke.ru/u/seoprofile"');
    expect(res.body).toContain('property="og:type" content="profile"');
  });

  it("несуществующий профиль даёт 404 и noindex", async () => {
    const res = await app.inject({ method: "GET", url: "/u/nobody-here" });
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain("noindex");
  });

  it("удалённый профиль доступен, но закрыт от индексации", async () => {
    const token = await registerAndLogin(app, "seogone");
    const id = userIdFromToken(token);
    const del = await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      headers: auth(token),
      payload: { password: "Passw0rd!" },
    });
    expect(del.statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: `/u/deleted_${id.replace(/-/g, "").slice(0, 24)}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("noindex");
    expect(res.body).not.toContain("og:type");
  });

  it("sitemap содержит профиль автора с постом, но не пустой профиль", async () => {
    const token = await registerAndLogin(app, "sitemapauthor");
    await registerAndLogin(app, "sitemapempty");
    await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: auth(token),
      payload: { title: "Пост", content: "Текст поста для sitemap", tags: [] },
    });

    const res = await app.inject({ method: "GET", url: "/sitemap.xml" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("https://vmetke.ru/u/sitemapauthor");
    expect(res.body).not.toContain("sitemapempty");
  });
});