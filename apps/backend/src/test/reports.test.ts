import "./env.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";
import { db } from "../db/client.js";
import { comments, conversations, messages, posts, reports, users } from "../db/schema/index.js";

type TestUser = { username: string; id: string; token: string };

let app: FastifyInstance;
let counter = 0;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function registerUser(prefix = "rp"): Promise<TestUser> {
  counter++;
  const username = `${prefix}${Date.now().toString(36)}${counter}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: `10.5.${Math.floor(counter / 250)}.${(counter % 250) + 1}`,
    payload: { email: `${username}@example.com`, password: "Password123!", username },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  return { username, id: body.user.id, token: body.accessToken };
}

const report = (reporter: TestUser | null, payload: Record<string, unknown>) =>
  app.inject({
    method: "POST",
    url: "/api/reports",
    headers: reporter ? { authorization: `Bearer ${reporter.token}` } : {},
    payload,
  });

const getRow = async (id: string) => (await db.select().from(reports).where(eq(reports.id, id)))[0];

async function makePost(authorId: string, content = "Текст поста") {
  const [p] = await db.insert(posts).values({ authorId, title: "Заголовок", content }).returning();
  return p;
}
async function makeComment(postId: string, authorId: string, content = "Комментарий") {
  const [c] = await db.insert(comments).values({ postId, authorId, content }).returning();
  return c;
}
async function makeConversation(a: string, b: string) {
  const [low, high] = [a, b].sort();
  const [c] = await db.insert(conversations).values({ userLowId: low, userHighId: high }).returning();
  return c;
}
async function makeMessage(conversationId: number, senderId: string, content: string) {
  const [m] = await db.insert(messages).values({ conversationId, senderId, content }).returning();
  return m;
}

describe("POST /api/reports: общее", () => {
  it("401 без токена", async () => {
    const res = await report(null, { targetType: "user", targetId: "00000000-0000-4000-8000-000000000000", reason: "spam" });
    expect(res.statusCode).toBe(401);
  });

  it("400 на некорректные данные", async () => {
    const u = await registerUser();
    const id = "00000000-0000-4000-8000-000000000000";
    expect((await report(u, { targetType: "nope", targetId: id, reason: "spam" })).statusCode).toBe(400);
    expect((await report(u, { targetType: "post", targetId: "not-a-uuid", reason: "spam" })).statusCode).toBe(400);
    expect((await report(u, { targetType: "post", targetId: id, reason: "boring" })).statusCode).toBe(400);
    expect((await report(u, { targetType: "post", targetId: id, reason: "other" })).statusCode).toBe(400);
    expect((await report(u, { targetType: "post", targetId: id, reason: "other", comment: "ab" })).statusCode).toBe(400);
    expect((await report(u, { targetType: "post", targetId: id, reason: "spam", comment: "x".repeat(501) })).statusCode).toBe(400);
    expect((await report(u, { targetType: "message", targetId: "abc", reason: "spam" })).statusCode).toBe(400);
    expect((await report(u, { targetType: "message", targetId: "99999999999", reason: "spam" })).statusCode).toBe(400);
  });

  it("не более 10 жалоб в час", async () => {
    const reporter = await registerUser();
    for (let i = 0; i < 10; i++) {
      const target = await registerUser();
      expect((await report(reporter, { targetType: "user", targetId: target.id, reason: "spam" })).statusCode).toBe(201);
    }
    const extra = await registerUser();
    expect((await report(reporter, { targetType: "user", targetId: extra.id, reason: "spam" })).statusCode).toBe(429);
  });
});

describe("жалоба на пост", () => {
  it("создаёт жалобу со снимком и автором", async () => {
    const author = await registerUser();
    const reporter = await registerUser();
    const post = await makePost(author.id, "Нарушающий текст");

    const res = await report(reporter, { targetType: "post", targetId: post.id, reason: "abuse", comment: "  оскорбления  " });
    expect(res.statusCode).toBe(201);

    const row = await getRow(res.json().id);
    expect(row).toMatchObject({
      reporterId: reporter.id,
      targetType: "post",
      targetId: post.id,
      targetUserId: author.id,
      reason: "abuse",
      comment: "оскорбления",
      status: "open",
    });
    expect(row.snapshot).toMatchObject({
      id: post.id,
      title: "Заголовок",
      content: "Нарушающий текст",
      authorId: author.id,
      authorUsername: author.username,
    });
  });

  it("нельзя на свой пост, 404 на несуществующий", async () => {
    const author = await registerUser();
    const post = await makePost(author.id);
    expect((await report(author, { targetType: "post", targetId: post.id, reason: "spam" })).statusCode).toBe(400);
    expect(
      (await report(author, { targetType: "post", targetId: "00000000-0000-4000-8000-000000000000", reason: "spam" })).statusCode,
    ).toBe(404);
  });

  it("повторная открытая жалоба 409, uuid в другом регистре тоже; после закрытия можно снова", async () => {
    const author = await registerUser();
    const reporter = await registerUser();
    const post = await makePost(author.id);

    const first = await report(reporter, { targetType: "post", targetId: post.id, reason: "spam" });
    expect(first.statusCode).toBe(201);
    expect((await report(reporter, { targetType: "post", targetId: post.id, reason: "spam" })).statusCode).toBe(409);
    expect(
      (await report(reporter, { targetType: "post", targetId: post.id.toUpperCase(), reason: "abuse" })).statusCode,
    ).toBe(409);

    await db.update(reports).set({ status: "dismissed" }).where(eq(reports.id, first.json().id));
    expect((await report(reporter, { targetType: "post", targetId: post.id, reason: "spam" })).statusCode).toBe(201);
  });

  it("разные жалобщики могут жаловаться на один пост", async () => {
    const author = await registerUser();
    const post = await makePost(author.id);
    for (let i = 0; i < 2; i++) {
      const r = await registerUser();
      expect((await report(r, { targetType: "post", targetId: post.id, reason: "spam" })).statusCode).toBe(201);
    }
  });
});

describe("жалоба на комментарий и пользователя", () => {
  it("комментарий: снимок и автор", async () => {
    const author = await registerUser();
    const reporter = await registerUser();
    const post = await makePost(author.id);
    const comment = await makeComment(post.id, author.id, "Грубость");

    const res = await report(reporter, { targetType: "comment", targetId: comment.id, reason: "abuse" });
    expect(res.statusCode).toBe(201);
    const row = await getRow(res.json().id);
    expect(row.targetUserId).toBe(author.id);
    expect(row.snapshot).toMatchObject({ id: comment.id, postId: post.id, content: "Грубость", authorUsername: author.username });
    expect((await report(author, { targetType: "comment", targetId: comment.id, reason: "spam" })).statusCode).toBe(400);
  });

  it("пользователь: снимок профиля, себя нельзя, удалённого нельзя", async () => {
    const target = await registerUser();
    const reporter = await registerUser();

    const res = await report(reporter, { targetType: "user", targetId: target.id, reason: "illegal" });
    expect(res.statusCode).toBe(201);
    const row = await getRow(res.json().id);
    expect(row.targetUserId).toBe(target.id);
    expect(row.snapshot).toMatchObject({ id: target.id, username: target.username });
    expect(row.snapshot).not.toHaveProperty("deletedAt");

    expect((await report(reporter, { targetType: "user", targetId: reporter.id, reason: "spam" })).statusCode).toBe(400);

    const gone = await registerUser();
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, gone.id));
    expect((await report(reporter, { targetType: "user", targetId: gone.id, reason: "spam" })).statusCode).toBe(404);
  });
});

describe("жалоба на личное сообщение", () => {
  async function setup() {
    const a = await registerUser(); // жалобщик
    const b = await registerUser();
    const conv = await makeConversation(a.id, b.id);
    return { a, b, conv };
  }

  it("снимок: сообщение и до 4 предыдущих", async () => {
    const { a, b, conv } = await setup();
    await makeMessage(conv.id, b.id, "m1");
    await makeMessage(conv.id, a.id, "m2");
    await makeMessage(conv.id, b.id, "m3");
    await makeMessage(conv.id, a.id, "m4");
    await makeMessage(conv.id, b.id, "m5");
    const reported = await makeMessage(conv.id, b.id, "m6");

    const res = await report(a, { targetType: "message", targetId: String(reported.id), reason: "abuse" });
    expect(res.statusCode).toBe(201);
    const row = await getRow(res.json().id);
    expect(row.targetUserId).toBe(b.id);
    expect(row.targetId).toBe(String(reported.id));

    const snap = row.snapshot as {
      message: { content: string; senderUsername: string };
      context: { content: string; senderUsername: string }[];
    };
    expect(snap.message).toMatchObject({ content: "m6", senderUsername: b.username });
    expect(snap.context.map((c) => c.content)).toEqual(["m2", "m3", "m4", "m5"]);
    expect(snap.context[0].senderUsername).toBe(a.username);
  });

  it("в контекст не попадают удалённые и скрытые жалобщиком сообщения", async () => {
    const { a, b, conv } = await setup();
    await makeMessage(conv.id, b.id, "m1");
    const m2 = await makeMessage(conv.id, a.id, "m2");
    await makeMessage(conv.id, b.id, "m3");
    await makeMessage(conv.id, a.id, "m4");
    const m5 = await makeMessage(conv.id, b.id, "m5");
    const reported = await makeMessage(conv.id, b.id, "m6");

    await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, m5.id));
    await db
      .update(conversations)
      .set(conv.userLowId === a.id ? { clearedLowId: m2.id } : { clearedHighId: m2.id })
      .where(eq(conversations.id, conv.id));

    const res = await report(a, { targetType: "message", targetId: String(reported.id), reason: "spam" });
    expect(res.statusCode).toBe(201);
    const snap = (await getRow(res.json().id)).snapshot as { context: { content: string }[] };
    expect(snap.context.map((c) => c.content)).toEqual(["m3", "m4"]);
  });

  it("не участник диалога получает 404", async () => {
    const { b, conv } = await setup();
    const m = await makeMessage(conv.id, b.id, "секрет");
    const stranger = await registerUser();
    expect((await report(stranger, { targetType: "message", targetId: String(m.id), reason: "spam" })).statusCode).toBe(404);
  });

  it("на своё сообщение 400; на удалённое, скрытое и из удалённого диалога 404", async () => {
    const { a, b, conv } = await setup();
    const mine = await makeMessage(conv.id, a.id, "моё");
    const deleted = await makeMessage(conv.id, b.id, "удалено");
    const hidden = await makeMessage(conv.id, b.id, "скрыто");
    const alive = await makeMessage(conv.id, b.id, "живое");

    expect((await report(a, { targetType: "message", targetId: String(mine.id), reason: "spam" })).statusCode).toBe(400);

    await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, deleted.id));
    expect((await report(a, { targetType: "message", targetId: String(deleted.id), reason: "spam" })).statusCode).toBe(404);

    await db
      .update(conversations)
      .set(conv.userLowId === a.id ? { clearedLowId: hidden.id } : { clearedHighId: hidden.id })
      .where(eq(conversations.id, conv.id));
    expect((await report(a, { targetType: "message", targetId: String(hidden.id), reason: "spam" })).statusCode).toBe(404);

    await db.update(conversations).set({ deletedAt: new Date() }).where(eq(conversations.id, conv.id));
    expect((await report(a, { targetType: "message", targetId: String(alive.id), reason: "spam" })).statusCode).toBe(404);
  });
});