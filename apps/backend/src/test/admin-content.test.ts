import "./env.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";
import { db } from "../db/client.js";
import { adminAuditLog, comments, posts } from "../db/schema/index.js";
import { grantRole } from "../services/admin.service.js";

type TestUser = { username: string; id: string; token: string };

let app: FastifyInstance;
let counter = 0;
let admin: TestUser;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});
// Сетап чистит БД между тестами, поэтому админ создаётся перед каждым
beforeEach(async () => {
  admin = await registerUser();
  await grantRole(admin.username, "admin");
});

async function registerUser(prefix = "ct"): Promise<TestUser> {
  counter++;
  const username = `${prefix}${Date.now().toString(36)}${counter}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: `10.4.${Math.floor(counter / 250)}.${(counter % 250) + 1}`,
    payload: { email: `${username}@example.com`, password: "Password123!", username },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  return { username, id: body.user.id, token: body.accessToken };
}

async function makePost(authorId: string, over: Partial<typeof posts.$inferInsert> = {}) {
  const [p] = await db
    .insert(posts)
    .values({ authorId, title: "Заголовок", content: "Текст поста", ...over })
    .returning();
  return p;
}

async function makeComment(
  postId: string,
  authorId: string,
  content = "Комментарий",
  over: Partial<typeof comments.$inferInsert> = {},
) {
  const [c] = await db.insert(comments).values({ postId, authorId, content, ...over }).returning();
  return c;
}

const call = (
  method: "GET" | "DELETE",
  url: string,
  token?: string,
  payload?: Record<string, unknown>,
) =>
  app.inject({
    method,
    url: `/api/admin/content${url}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload,
  });

const auditRows = (targetId: string, action: string) =>
  db
    .select()
    .from(adminAuditLog)
    .where(and(eq(adminAuditLog.targetId, targetId), eq(adminAuditLog.action, action)));

const NIL = "00000000-0000-4000-8000-000000000000";

describe("доступ", () => {
  it("401 без токена на всех роутах", async () => {
    expect((await call("GET", "/posts")).statusCode).toBe(401);
    expect((await call("GET", `/posts/${NIL}`)).statusCode).toBe(401);
    expect((await call("DELETE", `/posts/${NIL}`, undefined, { reason: "спам" })).statusCode).toBe(401);
    expect((await call("GET", "/comments")).statusCode).toBe(401);
    expect((await call("DELETE", `/comments/${NIL}`, undefined, { reason: "спам" })).statusCode).toBe(401);
  });

  it("403 для обычного пользователя на всех роутах", async () => {
    const u = await registerUser();
    expect((await call("GET", "/posts", u.token)).statusCode).toBe(403);
    expect((await call("GET", `/posts/${NIL}`, u.token)).statusCode).toBe(403);
    expect((await call("DELETE", `/posts/${NIL}`, u.token, { reason: "спам" })).statusCode).toBe(403);
    expect((await call("GET", "/comments", u.token)).statusCode).toBe(403);
    expect((await call("DELETE", `/comments/${NIL}`, u.token, { reason: "спам" })).statusCode).toBe(403);
  });

  it("модератор читает списки и удаляет", async () => {
    const mod = await registerUser();
    await grantRole(mod.username, "moderator");
    const author = await registerUser();
    const post = await makePost(author.id);

    expect((await call("GET", "/posts", mod.token)).statusCode).toBe(200);
    expect((await call("GET", "/comments", mod.token)).statusCode).toBe(200);
    expect((await call("DELETE", `/posts/${post.id}`, mod.token, { reason: "нарушение" })).statusCode).toBe(200);
  });
});

describe("список постов", () => {
  it("отдаёт автора и счётчики, сокращённый текст без полного content", async () => {
    const author = await registerUser();
    const post = await makePost(author.id, { content: "а".repeat(1000), tags: ["тест"] });
    await makeComment(post.id, author.id);

    const res = await call("GET", `/posts?author=${author.username}`, admin.token);
    expect(res.statusCode).toBe(200);
    const [item] = res.json().posts;
    expect(item.id).toBe(post.id);
    expect(item.author.username).toBe(author.username);
    expect(item.excerpt).toHaveLength(300);
    expect(item).not.toHaveProperty("content");
    expect(item.commentsCount).toBe(1);
    expect(item.likesCount).toBe(0);
    expect(item.tags).toEqual(["тест"]);
  });

  it("поиск по заголовку и по тексту", async () => {
    const author = await registerUser();
    const byTitle = await makePost(author.id, { title: "Уникальный_заголовок_xyz", content: "-" });
    const byContent = await makePost(author.id, { title: "-", content: "внутри лежит слово_маркер_xyz" });

    const t = (await call("GET", `/posts?q=${encodeURIComponent("заголовок_xyz")}`, admin.token)).json();
    expect(t.posts.map((p: { id: string }) => p.id)).toEqual([byTitle.id]);
    const c = (await call("GET", `/posts?q=${encodeURIComponent("слово_маркер_xyz")}`, admin.token)).json();
    expect(c.posts.map((p: { id: string }) => p.id)).toEqual([byContent.id]);
  });

  it("спецсимволы LIKE в поиске не работают как шаблон", async () => {
    const author = await registerUser();
    await makePost(author.id, { title: "без процента", content: "обычный текст" });
    const withPercent = await makePost(author.id, { title: "100% рабочий", content: "-" });

    const res = (await call("GET", `/posts?q=${encodeURIComponent("%")}`, admin.token)).json();
    expect(res.posts.map((p: { id: string }) => p.id)).toEqual([withPercent.id]);
  });

  it("фильтр по автору (без учёта регистра, только точное совпадение)", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const pa = await makePost(a.id);
    await makePost(b.id);

    const res = (await call("GET", `/posts?author=${a.username.toUpperCase()}`, admin.token)).json();
    expect(res.posts.map((p: { id: string }) => p.id)).toEqual([pa.id]);
    const partial = (await call("GET", `/posts?author=${a.username.slice(0, 6)}`, admin.token)).json();
    expect(partial.posts).toHaveLength(0);
  });

  it("фильтр по датам включает границы по дням (UTC)", async () => {
    const u = await registerUser();
    const p = await makePost(u.id, { createdAt: new Date("2026-01-15T12:00:00.000Z") });
    const ids = async (qs: string) =>
      (await call("GET", `/posts?author=${u.username}&${qs}`, admin.token))
        .json()
        .posts.map((x: { id: string }) => x.id);

    expect(await ids("from=2026-01-15&to=2026-01-15")).toEqual([p.id]);
    expect(await ids("from=2026-01-14&to=2026-01-16")).toEqual([p.id]);
    expect(await ids("to=2026-01-14")).toEqual([]);
    expect(await ids("from=2026-01-16")).toEqual([]);
  });

  it("курсорная пагинация без дублей и пропусков", async () => {
    const u = await registerUser();
    const created = [await makePost(u.id), await makePost(u.id), await makePost(u.id)];

    const p1 = (await call("GET", `/posts?author=${u.username}&limit=2`, admin.token)).json();
    expect(p1.posts).toHaveLength(2);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = (await call("GET", `/posts?author=${u.username}&limit=2&cursor=${p1.nextCursor}`, admin.token)).json();
    expect(p2.posts).toHaveLength(1);
    expect(p2.nextCursor).toBeNull();

    const ids = [...p1.posts, ...p2.posts].map((p: { id: string }) => p.id);
    expect(new Set(ids).size).toBe(3);
    expect([...ids].sort()).toEqual(created.map((c) => c.id).sort());
  });

  it("400 на неверные параметры", async () => {
    expect((await call("GET", "/posts?from=not-a-date", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "/posts?from=2026-13-45", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "/posts?cursor=nope", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "/posts?limit=101", admin.token)).statusCode).toBe(400);
  });
});

describe("карточка поста", () => {
  it("отдаёт полный текст", async () => {
    const u = await registerUser();
    const post = await makePost(u.id, { content: "б".repeat(1000) });
    const res = await call("GET", `/posts/${post.id}`, admin.token);
    expect(res.statusCode).toBe(200);
    expect(res.json().post.content).toHaveLength(1000);
    expect(res.json().post.author.username).toBe(u.username);
  });

  it("404 и 400", async () => {
    expect((await call("GET", `/posts/${NIL}`, admin.token)).statusCode).toBe(404);
    expect((await call("GET", "/posts/not-a-uuid", admin.token)).statusCode).toBe(400);
  });
});

describe("удаление поста", () => {
  it("удаляет пост с каскадом и сохраняет снимок в журнале", async () => {
    const author = await registerUser();
    const post = await makePost(author.id, { title: "Прощай", content: "Полный текст для снимка", tags: ["a", "b"] });
    await makeComment(post.id, author.id);

    const res = await call("DELETE", `/posts/${post.id}`, admin.token, { reason: "  спам  " });
    expect(res.statusCode).toBe(200);

    expect(await db.select().from(posts).where(eq(posts.id, post.id))).toHaveLength(0);
    expect(await db.select().from(comments).where(eq(comments.postId, post.id))).toHaveLength(0);

    const rows = await auditRows(post.id, "post.delete");
    expect(rows).toHaveLength(1);
    expect(rows[0].adminId).toBe(admin.id);
    expect(rows[0].targetType).toBe("post");
    expect(rows[0].details).toMatchObject({
      reason: "спам",
      snapshot: {
        id: post.id,
        authorId: author.id,
        authorUsername: author.username,
        title: "Прощай",
        content: "Полный текст для снимка",
        tags: ["a", "b"],
        commentsCount: 1,
        likesCount: 0,
      },
    });
  });

  it("причина обязательна и не пустая", async () => {
    const u = await registerUser();
    const post = await makePost(u.id);
    expect((await call("DELETE", `/posts/${post.id}`, admin.token)).statusCode).toBe(400);
    expect((await call("DELETE", `/posts/${post.id}`, admin.token, {})).statusCode).toBe(400);
    expect((await call("DELETE", `/posts/${post.id}`, admin.token, { reason: "  " })).statusCode).toBe(400);
    expect((await call("DELETE", `/posts/${post.id}`, admin.token, { reason: "x".repeat(501) })).statusCode).toBe(400);
    expect(await db.select().from(posts).where(eq(posts.id, post.id))).toHaveLength(1);
  });

  it("404 для несуществующего, повторное удаление тоже 404", async () => {
    expect((await call("DELETE", `/posts/${NIL}`, admin.token, { reason: "нет такого" })).statusCode).toBe(404);
    const u = await registerUser();
    const post = await makePost(u.id);
    expect((await call("DELETE", `/posts/${post.id}`, admin.token, { reason: "первый раз" })).statusCode).toBe(200);
    expect((await call("DELETE", `/posts/${post.id}`, admin.token, { reason: "второй раз" })).statusCode).toBe(404);
  });
});

describe("комментарии", () => {
  it("список: автор, пост и фильтры", async () => {
    const author = await registerUser();
    const other = await registerUser();
    const post = await makePost(author.id, { title: "К этому посту" });
    const mine = await makeComment(post.id, author.id, "уникальный_коммент_xyz");
    await makeComment(post.id, other.id, "чужой");

    const res = (await call("GET", `/comments?author=${author.username}`, admin.token)).json();
    expect(res.comments).toHaveLength(1);
    expect(res.comments[0]).toMatchObject({
      id: mine.id,
      content: "уникальный_коммент_xyz",
      author: { username: author.username },
      post: { id: post.id, title: "К этому посту" },
    });

    const bySearch = (await call("GET", `/comments?q=${encodeURIComponent("коммент_xyz")}`, admin.token)).json();
    expect(bySearch.comments.map((c: { id: string }) => c.id)).toEqual([mine.id]);
  });

  it("фильтр по датам и пагинация", async () => {
    const u = await registerUser();
    const post = await makePost(u.id);
    const old = await makeComment(post.id, u.id, "старый", { createdAt: new Date("2026-01-15T12:00:00.000Z") });
    await makeComment(post.id, u.id, "новый 1");
    await makeComment(post.id, u.id, "новый 2");

    const dated = (await call("GET", `/comments?author=${u.username}&from=2026-01-15&to=2026-01-15`, admin.token)).json();
    expect(dated.comments.map((c: { id: string }) => c.id)).toEqual([old.id]);

    const p1 = (await call("GET", `/comments?author=${u.username}&limit=2`, admin.token)).json();
    expect(p1.comments).toHaveLength(2);
    const p2 = (await call("GET", `/comments?author=${u.username}&limit=2&cursor=${p1.nextCursor}`, admin.token)).json();
    expect(p2.comments).toHaveLength(1);
    const ids = [...p1.comments, ...p2.comments].map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("удаление: комментарий исчезает, пост остаётся, снимок в журнале", async () => {
    const author = await registerUser();
    const post = await makePost(author.id);
    const comment = await makeComment(post.id, author.id, "текст для снимка");

    const res = await call("DELETE", `/comments/${comment.id}`, admin.token, { reason: "оскорбление" });
    expect(res.statusCode).toBe(200);

    expect(await db.select().from(comments).where(eq(comments.id, comment.id))).toHaveLength(0);
    expect(await db.select().from(posts).where(eq(posts.id, post.id))).toHaveLength(1);

    const rows = await auditRows(comment.id, "comment.delete");
    expect(rows).toHaveLength(1);
    expect(rows[0].adminId).toBe(admin.id);
    expect(rows[0].details).toMatchObject({
      reason: "оскорбление",
      snapshot: { id: comment.id, postId: post.id, authorUsername: author.username, content: "текст для снимка" },
    });
  });

  it("причина обязательна, 404 и 400", async () => {
    const u = await registerUser();
    const post = await makePost(u.id);
    const comment = await makeComment(post.id, u.id);
    expect((await call("DELETE", `/comments/${comment.id}`, admin.token, {})).statusCode).toBe(400);
    expect((await call("DELETE", `/comments/${NIL}`, admin.token, { reason: "нет такого" })).statusCode).toBe(404);
    expect((await call("DELETE", "/comments/not-a-uuid", admin.token, { reason: "плохой id" })).statusCode).toBe(400);
  });
});

describe("права модератора на чужой контент", () => {
  async function moderator() {
    const m = await registerUser();
    await grantRole(m.username, "moderator");
    return m;
  }

  it("модератор не может удалить пост модератора или админа", async () => {
    const mod = await moderator();
    for (const role of ["moderator", "admin"] as const) {
      const author = await registerUser();
      await grantRole(author.username, role);
      const post = await makePost(author.id);

      const res = await call("DELETE", `/posts/${post.id}`, mod.token, { reason: "попытка" });
      expect(res.statusCode).toBe(403);
      expect(await db.select().from(posts).where(eq(posts.id, post.id))).toHaveLength(1);
      expect(await auditRows(post.id, "post.delete")).toHaveLength(0);
    }
  });

  it("модератор не может удалить комментарий модератора или админа", async () => {
    const mod = await moderator();
    const owner = await registerUser();
    const post = await makePost(owner.id);
    for (const role of ["moderator", "admin"] as const) {
      const author = await registerUser();
      await grantRole(author.username, role);
      const comment = await makeComment(post.id, author.id);

      const res = await call("DELETE", `/comments/${comment.id}`, mod.token, { reason: "попытка" });
      expect(res.statusCode).toBe(403);
      expect(await db.select().from(comments).where(eq(comments.id, comment.id))).toHaveLength(1);
      expect(await auditRows(comment.id, "comment.delete")).toHaveLength(0);
    }
  });

  it("модератор удаляет свой пост и комментарий", async () => {
    const mod = await moderator();
    const post = await makePost(mod.id);
    const comment = await makeComment(post.id, mod.id);

    expect((await call("DELETE", `/comments/${comment.id}`, mod.token, { reason: "свой" })).statusCode).toBe(200);
    expect((await call("DELETE", `/posts/${post.id}`, mod.token, { reason: "свой" })).statusCode).toBe(200);
  });

  it("админ удаляет пост и комментарий модератора", async () => {
    const mod = await moderator();
    const post = await makePost(mod.id);
    const comment = await makeComment(post.id, mod.id);

    expect((await call("DELETE", `/comments/${comment.id}`, admin.token, { reason: "админ" })).statusCode).toBe(200);
    expect((await call("DELETE", `/posts/${post.id}`, admin.token, { reason: "админ" })).statusCode).toBe(200);
  });

  it("снимок в журнале содержит роль автора", async () => {
    const author = await registerUser();
    const post = await makePost(author.id);
    await call("DELETE", `/posts/${post.id}`, admin.token, { reason: "проверка снимка" });
    const [row] = await auditRows(post.id, "post.delete");
    expect(row.details).toMatchObject({ snapshot: { authorRole: "user" } });
  });
});