import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "./app.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

let ipCounter = 0;

async function registerAndLogin(name: string) {
  ipCounter += 1;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: `10.20.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`,
    payload: { email: `${name}@test.dev`, username: name, password: "Passw0rd!x" },
  });
  expect(res.json().accessToken, res.body).toBeTypeOf("string");
  const token = res.json().accessToken as string;
  const id = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub as string;
  return { id, headers: { authorization: `Bearer ${token}` } };
}

type User = Awaited<ReturnType<typeof registerAndLogin>>;

const block = (me: User, userId: string) =>
  app.inject({ method: "POST", url: "/api/blocks", headers: me.headers, payload: { userId } });
const unblock = (me: User, userId: string) =>
  app.inject({ method: "DELETE", url: `/api/blocks/${userId}`, headers: me.headers });
const openConversation = (me: User, userId: string) =>
  app.inject({ method: "POST", url: "/api/conversations", headers: me.headers, payload: { userId } });
const send = (me: User, conversationId: number, content = "привет") =>
  app.inject({
    method: "POST",
    url: `/api/conversations/${conversationId}/messages`,
    headers: me.headers,
    payload: { content },
  });

async function dialog(a: User, b: User) {
  const res = await openConversation(a, b.id);
  const id = res.json().conversation.id as number;
  expect((await send(a, id, "первое")).statusCode).toBe(201);
  return id;
}

describe("blocks", () => {
  it("блокирует пользователя, и он появляется в списке", async () => {
    const a = await registerAndLogin("blk_a1");
    const b = await registerAndLogin("blk_b1");

    expect((await block(a, b.id)).statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/blocks", headers: a.headers });
    expect(list.json().blocked.map((u: { id: string }) => u.id)).toEqual([b.id]);
  });

  it("блокировка идемпотентна", async () => {
    const a = await registerAndLogin("blk_a2");
    const b = await registerAndLogin("blk_b2");

    expect((await block(a, b.id)).statusCode).toBe(200);
    expect((await block(a, b.id)).statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/blocks", headers: a.headers });
    expect(list.json().blocked).toHaveLength(1);
  });

  it("не даёт заблокировать себя, несуществующего и по кривому id", async () => {
    const a = await registerAndLogin("blk_a3");

    expect((await block(a, a.id)).statusCode).toBe(400);
    expect((await block(a, "00000000-0000-4000-8000-000000000000")).statusCode).toBe(404);
    expect((await block(a, "not-a-uuid")).statusCode).toBe(400);
  });

  it("требует авторизацию", async () => {
    expect((await app.inject({ method: "GET", url: "/api/blocks" })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "POST", url: "/api/blocks", payload: { userId: "x" } })).statusCode,
    ).toBe(401);
  });

  it("разблокировка убирает из списка и идемпотентна", async () => {
    const a = await registerAndLogin("blk_a4");
    const b = await registerAndLogin("blk_b4");
    await block(a, b.id);

    expect((await unblock(a, b.id)).statusCode).toBe(200);
    expect((await unblock(a, b.id)).statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/blocks", headers: a.headers });
    expect(list.json().blocked).toEqual([]);
  });
});

describe("blocks: сообщения", () => {
  it("заблокированный не может писать в существующий диалог, сообщение не сохраняется", async () => {
    const a = await registerAndLogin("blk_a5");
    const b = await registerAndLogin("blk_b5");
    const convId = await dialog(a, b);

    await block(b, a.id);

    const res = await send(a, convId, "после блокировки");
    expect(res.statusCode).toBe(403);

    const history = await app.inject({
      method: "GET",
      url: `/api/conversations/${convId}/messages`,
      headers: b.headers,
    });
    expect(history.json().messages.map((m: { content: string }) => m.content)).toEqual(["первое"]);
  });

  it("заблокировавший тоже не может писать, пока не разблокирует", async () => {
    const a = await registerAndLogin("blk_a6");
    const b = await registerAndLogin("blk_b6");
    const convId = await dialog(a, b);

    await block(b, a.id);
    expect((await send(b, convId)).statusCode).toBe(403);

    await unblock(b, a.id);
    expect((await send(b, convId)).statusCode).toBe(201);
    expect((await send(a, convId)).statusCode).toBe(201);
  });

  it("нельзя создать новый диалог в любую сторону, существующий возвращается", async () => {
    const a = await registerAndLogin("blk_a7");
    const b = await registerAndLogin("blk_b7");
    const c = await registerAndLogin("blk_c7");

    await block(b, a.id);
    expect((await openConversation(a, b.id)).statusCode).toBe(403);
    expect((await openConversation(b, a.id)).statusCode).toBe(403);

    // c <-> a уже общались до блокировки c -> a
    const convId = await dialog(c, a);
    await block(a, c.id);
    const again = await openConversation(c, a.id);
    expect(again.statusCode).toBe(200);
    expect(again.json().conversation.id).toBe(convId);
  });

  it("список диалогов отдаёт blockedByMe только тому, кто заблокировал", async () => {
    const a = await registerAndLogin("blk_a8");
    const b = await registerAndLogin("blk_b8");
    await dialog(a, b);
    await block(b, a.id);

    const forB = await app.inject({ method: "GET", url: "/api/conversations", headers: b.headers });
    const forA = await app.inject({ method: "GET", url: "/api/conversations", headers: a.headers });
    expect(forB.json().conversations[0].blockedByMe).toBe(true);
    expect(forA.json().conversations[0].blockedByMe).toBe(false);
  });

  it("история читается после блокировки, флаг blockedByMe приходит в ответе", async () => {
    const a = await registerAndLogin("blk_a9");
    const b = await registerAndLogin("blk_b9");
    const convId = await dialog(a, b);
    await block(b, a.id);

    const url = `/api/conversations/${convId}/messages`;
    const forB = await app.inject({ method: "GET", url, headers: b.headers });
    const forA = await app.inject({ method: "GET", url, headers: a.headers });
    expect(forB.statusCode).toBe(200);
    expect(forB.json().messages).toHaveLength(1);
    expect(forB.json().blockedByMe).toBe(true);
    expect(forA.json().blockedByMe).toBe(false);
  });

  it("блокировка не влияет на других пользователей", async () => {
    const a = await registerAndLogin("blk_a10");
    const b = await registerAndLogin("blk_b10");
    const c = await registerAndLogin("blk_c10");
    await block(b, a.id);

    const convId = await dialog(c, b);
    expect((await send(b, convId)).statusCode).toBe(201);
  });
});