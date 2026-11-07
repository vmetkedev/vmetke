import "./env.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";
import { db } from "../db/client.js";
import { adminAuditLog, comments, conversations, messages, posts, reports, users } from "../db/schema/index.js";
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

async function registerUser(prefix = "ar"): Promise<TestUser> {
  counter++;
  const username = `${prefix}${Date.now().toString(36)}${counter}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: `10.6.${Math.floor(counter / 250)}.${(counter % 250) + 1}`,
    payload: { email: `${username}@example.com`, password: "Password123!", username },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  return { username, id: body.user.id, token: body.accessToken };
}

async function moderator() {
  const m = await registerUser();
  await grantRole(m.username, "moderator");
  return m;
}

async function fileReport(reporter: TestUser, targetType: string, targetId: string, reason = "spam") {
  const res = await app.inject({
    method: "POST",
    url: "/api/reports",
    headers: { authorization: `Bearer ${reporter.token}` },
    payload: { targetType, targetId, reason },
  });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
}

async function makePost(authorId: string, content = "Текст поста") {
  const [p] = await db.insert(posts).values({ authorId, title: "Заголовок", content }).returning();
  return p;
}
async function makeComment(postId: string, authorId: string) {
  const [c] = await db.insert(comments).values({ postId, authorId, content: "Комментарий" }).returning();
  return c;
}

const call = (
  method: "GET" | "POST",
  url: string,
  token?: string,
  payload?: Record<string, unknown>,
) =>
  app.inject({
    method,
    url: `/api/admin/reports${url}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload,
  });

const resolve = (id: string, token: string, payload: Record<string, unknown>) =>
  call("POST", `/${id}/resolve`, token, payload);

const getRow = async (id: string) => (await db.select().from(reports).where(eq(reports.id, id)))[0];
const auditRows = (targetId: string, action: string) =>
  db
    .select()
    .from(adminAuditLog)
    .where(and(eq(adminAuditLog.targetId, targetId), eq(adminAuditLog.action, action)));

const NIL = "00000000-0000-4000-8000-000000000000";

describe("доступ", () => {
  it("401 без токена", async () => {
    expect((await call("GET", "")).statusCode).toBe(401);
    expect((await call("GET", `/${NIL}`)).statusCode).toBe(401);
    expect((await call("POST", `/${NIL}/resolve`, undefined, { action: "dismiss" })).statusCode).toBe(401);
  });

  it("403 для обычного пользователя", async () => {
    const u = await registerUser();
    expect((await call("GET", "", u.token)).statusCode).toBe(403);
    expect((await call("GET", `/${NIL}`, u.token)).statusCode).toBe(403);
    expect((await call("POST", `/${NIL}/resolve`, u.token, { action: "dismiss" })).statusCode).toBe(403);
  });

  it("модератор читает очередь", async () => {
    const mod = await moderator();
    expect((await call("GET", "", mod.token)).statusCode).toBe(200);
  });
});

describe("список", () => {
  it("по умолчанию только открытые; без полного снимка, с предпросмотром", async () => {
    const author = await registerUser();
    const reporter = await registerUser();
    const post = await makePost(author.id, "а".repeat(500));
    const id = await fileReport(reporter, "post", post.id, "abuse");

    const res = await call("GET", "", admin.token);
    expect(res.statusCode).toBe(200);
    const items = res.json().reports as Array<Record<string, any>>;
    expect(items.every((i) => i.status === "open")).toBe(true);
    const item = items.find((i) => i.id === id)!;
    expect(item).toMatchObject({
      targetType: "post",
      targetId: post.id,
      reason: "abuse",
      reporter: { id: reporter.id, username: reporter.username },
      targetUser: { id: author.id, username: author.username, role: "user" },
    });
    expect(item.preview).toHaveLength(200);
    expect(item).not.toHaveProperty("snapshot");
  });

  it("фильтры по статусу и типу", async () => {
    const author = await registerUser();
    const r1 = await registerUser();
    const r2 = await registerUser();
    const post = await makePost(author.id);
    const postReport = await fileReport(r1, "post", post.id);
    const userReport = await fileReport(r2, "user", author.id);
    expect((await resolve(postReport, admin.token, { action: "dismiss" })).statusCode).toBe(200);

    const ids = async (qs: string) =>
      (await call("GET", `?${qs}`, admin.token)).json().reports.map((r: { id: string }) => r.id);

    expect(await ids("")).toContain(userReport);
    expect(await ids("")).not.toContain(postReport);
    expect(await ids("status=dismissed")).toContain(postReport);
    const all = await ids("status=all");
    expect(all).toContain(postReport);
    expect(all).toContain(userReport);
    const onlyUsers = (await call("GET", "?status=all&targetType=user", admin.token)).json().reports;
    expect(onlyUsers.every((r: { targetType: string }) => r.targetType === "user")).toBe(true);
    expect(onlyUsers.map((r: { id: string }) => r.id)).toContain(userReport);
  });

  it("курсорная пагинация без дублей и пропусков", async () => {
    const created: string[] = [];
    for (let i = 0; i < 3; i++) {
      const target = await registerUser();
      const reporter = await registerUser();
      created.push(await fileReport(reporter, "user", target.id));
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 50; guard++) {
      const res: any = (await call("GET", `?limit=2${cursor ? `&cursor=${cursor}` : ""}`, admin.token)).json();
      seen.push(...res.reports.map((r: { id: string }) => r.id));
      cursor = res.nextCursor;
      if (!cursor) break;
    }
    expect(new Set(seen).size).toBe(seen.length);
    for (const id of created) expect(seen).toContain(id);
  });

  it("400 на неверные параметры", async () => {
    expect((await call("GET", "?status=weird", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "?targetType=weird", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "?cursor=nope", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "?limit=101", admin.token)).statusCode).toBe(400);
  });
});

describe("карточка", () => {
  it("снимок, наличие контента и число открытых жалоб на объект", async () => {
    const author = await registerUser();
    const r1 = await registerUser();
    const r2 = await registerUser();
    const post = await makePost(author.id, "Полный текст");
    const id = await fileReport(r1, "post", post.id);
    await fileReport(r2, "post", post.id);

    const res = await call("GET", `/${id}`, admin.token);
    expect(res.statusCode).toBe(200);
    const { report } = res.json();
    expect(report.snapshot).toMatchObject({ content: "Полный текст", authorUsername: author.username });
    expect(report.contentExists).toBe(true);
    expect(report.openReportsForTarget).toBe(2);
    expect(report.targetUser).toMatchObject({ id: author.id, role: "user", bannedAt: null });
    expect(report.resolvedBy).toBeNull();

    await db.delete(posts).where(eq(posts.id, post.id));
    expect((await call("GET", `/${id}`, admin.token)).json().report.contentExists).toBe(false);
  });

  it("жалоба на ЛС: только снимок жалобщика", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const [low, high] = [a.id, b.id].sort();
    const [conv] = await db.insert(conversations).values({ userLowId: low, userHighId: high }).returning();
    await db.insert(messages).values({ conversationId: conv.id, senderId: a.id, content: "предыдущее" });
    const [m] = await db
      .insert(messages)
      .values({ conversationId: conv.id, senderId: b.id, content: "оскорбление" })
      .returning();
    await db.insert(messages).values({ conversationId: conv.id, senderId: b.id, content: "позднее, в снимок не попадёт" });

    const id = await fileReport(a, "message", String(m.id), "abuse");
    const { report } = (await call("GET", `/${id}`, admin.token)).json();
    expect(report.snapshot.message.content).toBe("оскорбление");
    expect(report.snapshot.context.map((c: { content: string }) => c.content)).toEqual(["предыдущее"]);
    expect(report.contentExists).toBe(false);
    expect(report.targetUser.id).toBe(b.id);
  });

  it("404 и 400", async () => {
    expect((await call("GET", `/${NIL}`, admin.token)).statusCode).toBe(404);
    expect((await call("GET", "/not-a-uuid", admin.token)).statusCode).toBe(400);
  });
});

describe("отклонить", () => {
  it("закрывает только эту жалобу, пишет журнал, причина необязательна", async () => {
    const author = await registerUser();
    const r1 = await registerUser();
    const r2 = await registerUser();
    const post = await makePost(author.id);
    const first = await fileReport(r1, "post", post.id);
    const second = await fileReport(r2, "post", post.id);

    expect((await resolve(first, admin.token, { action: "dismiss" })).statusCode).toBe(200);

    expect(await getRow(first)).toMatchObject({
      status: "dismissed",
      resolvedBy: admin.id,
      resolutionAction: "dismissed",
    });
    expect((await getRow(second)).status).toBe("open");
    const rows = await auditRows(first, "report.dismiss");
    expect(rows).toHaveLength(1);
    expect(rows[0].adminId).toBe(admin.id);
  });

  it("повторная обработка 409, неизвестная жалоба 404", async () => {
    const author = await registerUser();
    const r = await registerUser();
    const id = await fileReport(r, "user", author.id);
    expect((await resolve(id, admin.token, { action: "dismiss" })).statusCode).toBe(200);
    expect((await resolve(id, admin.token, { action: "dismiss" })).statusCode).toBe(409);
    expect((await resolve(NIL, admin.token, { action: "dismiss" })).statusCode).toBe(404);
  });

  it("400 на неизвестное действие", async () => {
    const author = await registerUser();
    const r = await registerUser();
    const id = await fileReport(r, "user", author.id);
    expect((await resolve(id, admin.token, { action: "explode" })).statusCode).toBe(400);
    expect((await resolve(id, admin.token, {})).statusCode).toBe(400);
  });

  it("модератор тоже может отклонять", async () => {
    const mod = await moderator();
    const author = await registerUser();
    const r = await registerUser();
    const id = await fileReport(r, "user", author.id);
    expect((await resolve(id, mod.token, { action: "dismiss" })).statusCode).toBe(200);
  });
});

describe("удалить контент", () => {
  it("удаляет пост, закрывает все открытые жалобы на него, пишет журнал", async () => {
    const author = await registerUser();
    const r1 = await registerUser();
    const r2 = await registerUser();
    const post = await makePost(author.id);
    const first = await fileReport(r1, "post", post.id);
    const second = await fileReport(r2, "post", post.id);

    const res = await resolve(first, admin.token, { action: "delete_content", reason: "спам" });
    expect(res.statusCode).toBe(200);

    expect(await db.select().from(posts).where(eq(posts.id, post.id))).toHaveLength(0);
    for (const id of [first, second]) {
      expect(await getRow(id)).toMatchObject({
        status: "resolved",
        resolvedBy: admin.id,
        resolutionAction: "content_deleted",
        resolutionReason: "спам",
      });
    }
    expect(await auditRows(post.id, "post.delete")).toHaveLength(1);
    const resolveRows = await auditRows(first, "report.resolve");
    expect(resolveRows).toHaveLength(1);
    expect((resolveRows[0].details as { resolvedReportIds: string[] }).resolvedReportIds).toHaveLength(2);
  });

  it("удаляет комментарий", async () => {
    const author = await registerUser();
    const r = await registerUser();
    const post = await makePost(author.id);
    const comment = await makeComment(post.id, author.id);
    const id = await fileReport(r, "comment", comment.id, "abuse");

    expect((await resolve(id, admin.token, { action: "delete_content", reason: "оскорбление" })).statusCode).toBe(200);
    expect(await db.select().from(comments).where(eq(comments.id, comment.id))).toHaveLength(0);
    expect(await db.select().from(posts).where(eq(posts.id, post.id))).toHaveLength(1);
  });

  it("модератор удаляет пост обычного пользователя", async () => {
    const mod = await moderator();
    const author = await registerUser();
    const r = await registerUser();
    const post = await makePost(author.id);
    const id = await fileReport(r, "post", post.id);
    expect((await resolve(id, mod.token, { action: "delete_content", reason: "спам" })).statusCode).toBe(200);
  });

  it("модератор не может удалить пост модератора: 403, всё остаётся", async () => {
    const mod = await moderator();
    const authorMod = await moderator();
    const r = await registerUser();
    const post = await makePost(authorMod.id);
    const id = await fileReport(r, "post", post.id);

    expect((await resolve(id, mod.token, { action: "delete_content", reason: "попытка" })).statusCode).toBe(403);
    expect(await db.select().from(posts).where(eq(posts.id, post.id))).toHaveLength(1);
    expect((await getRow(id)).status).toBe("open");
    expect((await resolve(id, admin.token, { action: "delete_content", reason: "админ можно" })).statusCode).toBe(200);
  });

  it("причина обязательна", async () => {
    const author = await registerUser();
    const r = await registerUser();
    const post = await makePost(author.id);
    const id = await fileReport(r, "post", post.id);
    expect((await resolve(id, admin.token, { action: "delete_content" })).statusCode).toBe(400);
    expect((await resolve(id, admin.token, { action: "delete_content", reason: "  " })).statusCode).toBe(400);
    expect((await getRow(id)).status).toBe("open");
  });

  it("контент уже удалён: 404, жалоба остаётся открытой", async () => {
    const author = await registerUser();
    const r = await registerUser();
    const post = await makePost(author.id);
    const id = await fileReport(r, "post", post.id);
    await db.delete(posts).where(eq(posts.id, post.id));

    expect((await resolve(id, admin.token, { action: "delete_content", reason: "поздно" })).statusCode).toBe(404);
    expect((await getRow(id)).status).toBe("open");
  });

  it("для жалоб на пользователя и ЛС удалять нечего: 400", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const userReport = await fileReport(a, "user", b.id);
    expect((await resolve(userReport, admin.token, { action: "delete_content", reason: "нечего" })).statusCode).toBe(400);

    const [low, high] = [a.id, b.id].sort();
    const [conv] = await db.insert(conversations).values({ userLowId: low, userHighId: high }).returning();
    const [m] = await db.insert(messages).values({ conversationId: conv.id, senderId: b.id, content: "текст" }).returning();
    const msgReport = await fileReport(a, "message", String(m.id));
    expect((await resolve(msgReport, admin.token, { action: "delete_content", reason: "нечего" })).statusCode).toBe(400);
    expect(await db.select().from(messages).where(eq(messages.id, m.id))).toHaveLength(1);
  });

  it("удаление по жалобе уведомляет автора", async () => {
    const author = await registerUser();
    const r = await registerUser();
    const post = await makePost(author.id);
    const id = await fileReport(r, "post", post.id);
    expect((await resolve(id, admin.token, { action: "delete_content", reason: "спам" })).statusCode).toBe(200);

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: { authorization: `Bearer ${author.token}` },
    });
    expect(res.json().notifications[0]).toMatchObject({
      type: "moderation",
      details: { action: "post_deleted", reason: "спам" },
    });
  });
});

describe("забанить автора", () => {
  it("админ банит автора поста, жалоба закрыта, журнал", async () => {
    const author = await registerUser();
    const r = await registerUser();
    const post = await makePost(author.id);
    const id = await fileReport(r, "post", post.id);

    expect((await resolve(id, admin.token, { action: "ban_author", reason: "систематический спам" })).statusCode).toBe(200);

    const [u] = await db.select().from(users).where(eq(users.id, author.id));
    expect(u.bannedAt).not.toBeNull();
    expect(u.banReason).toBe("систематический спам");
    expect(await getRow(id)).toMatchObject({ status: "resolved", resolutionAction: "author_banned" });
    expect(await auditRows(author.id, "user.ban")).toHaveLength(1);
    expect(await auditRows(id, "report.resolve")).toHaveLength(1);
    // Пост остаётся: это отдельное действие
    expect(await db.select().from(posts).where(eq(posts.id, post.id))).toHaveLength(1);
  });

  it("жалоба на ЛС: банится отправитель", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const [low, high] = [a.id, b.id].sort();
    const [conv] = await db.insert(conversations).values({ userLowId: low, userHighId: high }).returning();
    const [m] = await db.insert(messages).values({ conversationId: conv.id, senderId: b.id, content: "угрозы" }).returning();
    const id = await fileReport(a, "message", String(m.id), "illegal");

    expect((await resolve(id, admin.token, { action: "ban_author", reason: "угрозы в ЛС" })).statusCode).toBe(200);
    const [u] = await db.select().from(users).where(eq(users.id, b.id));
    expect(u.bannedAt).not.toBeNull();
  });

  it("модератор не может банить: 403, ничего не меняется", async () => {
    const mod = await moderator();
    const author = await registerUser();
    const r = await registerUser();
    const id = await fileReport(r, "user", author.id);

    expect((await resolve(id, mod.token, { action: "ban_author", reason: "попытка" })).statusCode).toBe(403);
    const [u] = await db.select().from(users).where(eq(users.id, author.id));
    expect(u.bannedAt).toBeNull();
    expect((await getRow(id)).status).toBe("open");
  });

  it("причина обязательна", async () => {
    const author = await registerUser();
    const r = await registerUser();
    const id = await fileReport(r, "user", author.id);
    expect((await resolve(id, admin.token, { action: "ban_author" })).statusCode).toBe(400);
  });

  it("автор уже заблокирован: жалоба закрывается без повторного бана", async () => {
    const author = await registerUser();
    const r = await registerUser();
    const id = await fileReport(r, "user", author.id);
    await db.update(users).set({ bannedAt: new Date(), banReason: "ранее" }).where(eq(users.id, author.id));

    expect((await resolve(id, admin.token, { action: "ban_author", reason: "дубль" })).statusCode).toBe(200);
    expect(await getRow(id)).toMatchObject({ status: "resolved", resolutionAction: "author_banned" });
    expect(await auditRows(author.id, "user.ban")).toHaveLength(0);
  });

  it("автор удалил аккаунт: 409, жалоба открыта", async () => {
    const author = await registerUser();
    const r = await registerUser();
    const id = await fileReport(r, "user", author.id);
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, author.id));

    expect((await resolve(id, admin.token, { action: "ban_author", reason: "поздно" })).statusCode).toBe(409);
    expect((await getRow(id)).status).toBe("open");
  });
});

describe("счётчик открытых жалоб", () => {
  const count = async (token: string) => (await call("GET", "/open-count", token)).json().count as number;

  it("растёт с новой жалобой и падает после обработки; доступен модератору", async () => {
    const mod = await moderator();
    const before = await count(mod.token);

    const author = await registerUser();
    const reporter = await registerUser();
    const id = await fileReport(reporter, "user", author.id);
    expect(await count(mod.token)).toBe(before + 1);

    expect((await resolve(id, mod.token, { action: "dismiss" })).statusCode).toBe(200);
    expect(await count(mod.token)).toBe(before);
  });
});