import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";

async function registerAndLogin(app: FastifyInstance, username: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: `${username}@test.com`, password: "Passw0rd!", username },
  });
  return res.json().accessToken as string;
}

// id пользователя лежит в поле sub access-токена
function userIdFromToken(token: string) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub as string;
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

async function openConversation(app: FastifyInstance, token: string, otherUserId: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/conversations",
    headers: auth(token),
    payload: { userId: otherUserId },
  });
  return res.json().conversation as { id: number };
}

function send(app: FastifyInstance, token: string, conversationId: number, content: string) {
  return app.inject({
    method: "POST",
    url: `/api/conversations/${conversationId}/messages`,
    headers: auth(token),
    payload: { content },
  });
}

describe("messages", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects unauthenticated access", async () => {
    const res = await app.inject({ method: "GET", url: "/api/conversations" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a conversation with yourself and with a non-existent user", async () => {
    const alice = await registerAndLogin(app, "alice1");

    const self = await app.inject({
      method: "POST",
      url: "/api/conversations",
      headers: auth(alice),
      payload: { userId: userIdFromToken(alice) },
    });
    expect(self.statusCode).toBe(400);

    const ghost = await app.inject({
      method: "POST",
      url: "/api/conversations",
      headers: auth(alice),
      payload: { userId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(ghost.statusCode).toBe(404);

    const malformed = await app.inject({
      method: "POST",
      url: "/api/conversations",
      headers: auth(alice),
      payload: { userId: "not-a-uuid" },
    });
    expect(malformed.statusCode).toBe(400);
  });

  it("returns the same conversation for a pair regardless of who opens it", async () => {
    const alice = await registerAndLogin(app, "alice2");
    const bob = await registerAndLogin(app, "bob2");

    const a = await openConversation(app, alice, userIdFromToken(bob));
    const b = await openConversation(app, bob, userIdFromToken(alice));
    expect(a.id).toBe(b.id);
  });

  it("sends a message and validates its content", async () => {
    const alice = await registerAndLogin(app, "alice3");
    const bob = await registerAndLogin(app, "bob3");
    const conv = await openConversation(app, alice, userIdFromToken(bob));

    const ok = await send(app, alice, conv.id, "привет");
    expect(ok.statusCode).toBe(201);
    expect(ok.json().message.content).toBe("привет");

    expect((await send(app, alice, conv.id, "   ")).statusCode).toBe(400);
    expect((await send(app, alice, conv.id, "x".repeat(5001))).statusCode).toBe(400);
  });

  it("hides a conversation from a third user", async () => {
    const alice = await registerAndLogin(app, "alice4");
    const bob = await registerAndLogin(app, "bob4");
    const eve = await registerAndLogin(app, "eve4");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    await send(app, alice, conv.id, "секрет");

    const read = await app.inject({
      method: "GET",
      url: `/api/conversations/${conv.id}/messages`,
      headers: auth(eve),
    });
    expect(read.statusCode).toBe(404);
    expect((await send(app, eve, conv.id, "я тут")).statusCode).toBe(404);
  });

  it("paginates history by cursor, newest first", async () => {
    const alice = await registerAndLogin(app, "alice5");
    const bob = await registerAndLogin(app, "bob5");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    for (let i = 1; i <= 5; i++) await send(app, alice, conv.id, `m${i}`);

    const page1 = (
      await app.inject({
        method: "GET",
        url: `/api/conversations/${conv.id}/messages?limit=2`,
        headers: auth(bob),
      })
    ).json();
    expect(page1.messages.map((m: { content: string }) => m.content)).toEqual(["m5", "m4"]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = (
      await app.inject({
        method: "GET",
        url: `/api/conversations/${conv.id}/messages?limit=10&before=${page1.nextCursor}`,
        headers: auth(bob),
      })
    ).json();
    expect(page2.messages.map((m: { content: string }) => m.content)).toEqual(["m3", "m2", "m1"]);
    expect(page2.nextCursor).toBeNull();
  });

  it("lists conversations with the last message and unread count", async () => {
    const alice = await registerAndLogin(app, "alice6");
    const bob = await registerAndLogin(app, "bob6");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    await send(app, alice, conv.id, "один");
    await send(app, alice, conv.id, "два");

    const bobList = (
      await app.inject({ method: "GET", url: "/api/conversations", headers: auth(bob) })
    ).json().conversations;
    expect(bobList).toHaveLength(1);
    expect(bobList[0].otherUser.username).toBe("alice6");
    expect(bobList[0].lastMessage.content).toBe("два");
    expect(bobList[0].unreadCount).toBe(2);

    const aliceList = (
      await app.inject({ method: "GET", url: "/api/conversations", headers: auth(alice) })
    ).json().conversations;
    expect(aliceList[0].otherUser.username).toBe("bob6");
    expect(aliceList[0].unreadCount).toBe(0);
  });

  it("does not list a conversation that has no messages yet", async () => {
    const alice = await registerAndLogin(app, "alice7");
    const bob = await registerAndLogin(app, "bob7");
    await openConversation(app, alice, userIdFromToken(bob));

    const list = (
      await app.inject({ method: "GET", url: "/api/conversations", headers: auth(alice) })
    ).json().conversations;
    expect(list).toHaveLength(0);
  });

  it("resets the unread count after marking as read", async () => {
    const alice = await registerAndLogin(app, "alice8");
    const bob = await registerAndLogin(app, "bob8");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    await send(app, alice, conv.id, "раз");

    const read = await app.inject({
      method: "POST",
      url: `/api/conversations/${conv.id}/read`,
      headers: auth(bob),
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().success).toBe(true);

    const list = (
      await app.inject({ method: "GET", url: "/api/conversations", headers: auth(bob) })
    ).json().conversations;
    expect(list[0].unreadCount).toBe(0);
  });

  it("rejects a malformed conversation id", async () => {
    const alice = await registerAndLogin(app, "alice9");

    const res = await app.inject({
      method: "GET",
      url: "/api/conversations/abc/messages",
      headers: auth(alice),
    });
    expect(res.statusCode).toBe(400);
  });
});