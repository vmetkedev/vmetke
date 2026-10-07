import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";
import { CREATE_LIMIT, SEND_LIMIT } from "../routes/messages.js";

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

function open(app: FastifyInstance, token: string, otherUserId: string) {
  return app.inject({
    method: "POST",
    url: "/api/conversations",
    headers: auth(token),
    payload: { userId: otherUserId },
  });
}

function send(app: FastifyInstance, token: string, conversationId: number, content: string) {
  return app.inject({
    method: "POST",
    url: `/api/conversations/${conversationId}/messages`,
    headers: auth(token),
    payload: { content },
  });
}

describe("messages rate limit", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("блокирует отправку после SEND_LIMIT сообщений и не сохраняет лишнее", async () => {
    const alice = await registerAndLogin(app, "rl_alice1");
    const bob = await registerAndLogin(app, "rl_bob1");
    const conv = (await open(app, alice, userIdFromToken(bob))).json().conversation as { id: number };

    for (let i = 0; i < SEND_LIMIT; i++) {
      expect((await send(app, alice, conv.id, `m${i}`)).statusCode).toBe(201);
    }

    const blocked = await send(app, alice, conv.id, "лишнее");
    expect(blocked.statusCode).toBe(429);
    expect(typeof blocked.json().error).toBe("string");

    const history = (
      await app.inject({
        method: "GET",
        url: `/api/conversations/${conv.id}/messages?limit=100`,
        headers: auth(bob),
      })
    ).json();
    expect(history.messages).toHaveLength(SEND_LIMIT);
    expect(history.messages.some((m: { content: string }) => m.content === "лишнее")).toBe(false);
  });

  it("лимитирует по пользователю, а не по IP: другой пользователь с того же IP пишет свободно", async () => {
    const alice = await registerAndLogin(app, "rl_alice2");
    const bob = await registerAndLogin(app, "rl_bob2");
    const conv = (await open(app, alice, userIdFromToken(bob))).json().conversation as { id: number };

    for (let i = 0; i < SEND_LIMIT; i++) await send(app, alice, conv.id, `m${i}`);
    expect((await send(app, alice, conv.id, "ещё")).statusCode).toBe(429);

    expect((await send(app, bob, conv.id, "ответ")).statusCode).toBe(201);
  });

  it("лимит отправки не мешает читать историю и список диалогов", async () => {
    const alice = await registerAndLogin(app, "rl_alice3");
    const bob = await registerAndLogin(app, "rl_bob3");
    const conv = (await open(app, alice, userIdFromToken(bob))).json().conversation as { id: number };

    for (let i = 0; i < SEND_LIMIT; i++) await send(app, alice, conv.id, `m${i}`);
    expect((await send(app, alice, conv.id, "ещё")).statusCode).toBe(429);

    const history = await app.inject({
      method: "GET",
      url: `/api/conversations/${conv.id}/messages`,
      headers: auth(alice),
    });
    expect(history.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/conversations", headers: auth(alice) });
    expect(list.statusCode).toBe(200);
  });

  it("блокирует создание диалогов после CREATE_LIMIT запросов", async () => {
    const alice = await registerAndLogin(app, "rl_alice4");
    const bob = await registerAndLogin(app, "rl_bob4");
    const bobId = userIdFromToken(bob);

    for (let i = 0; i < CREATE_LIMIT; i++) {
      expect((await open(app, alice, bobId)).statusCode).toBe(200);
    }
    expect((await open(app, alice, bobId)).statusCode).toBe(429);

    // у другого пользователя свой счётчик
    expect((await open(app, bob, userIdFromToken(alice))).statusCode).toBe(200);
  });
});