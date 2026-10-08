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

  const listOf = async (token: string) =>
    (await app.inject({ method: "GET", url: "/api/conversations", headers: auth(token) })).json()
      .conversations;

  const historyOf = async (token: string, convId: number) =>
    (
      await app.inject({
        method: "GET",
        url: `/api/conversations/${convId}/messages`,
        headers: auth(token),
      })
    ).json().messages as { id: number; content: string; deleted: boolean }[];

  it("deletes own message as a tombstone and forbids deleting others'", async () => {
    const alice = await registerAndLogin(app, "alice10");
    const bob = await registerAndLogin(app, "bob10");
    const eve = await registerAndLogin(app, "eve10");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "ошибся")).json().message as { id: number };
    const url = `/api/conversations/${conv.id}/messages/${msg.id}`;

    expect((await app.inject({ method: "DELETE", url, headers: auth(bob) })).statusCode).toBe(403);
    expect((await app.inject({ method: "DELETE", url, headers: auth(eve) })).statusCode).toBe(404);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/conversations/${conv.id}/messages/999999`,
          headers: auth(alice),
        })
      ).statusCode,
    ).toBe(404);

    expect((await app.inject({ method: "DELETE", url, headers: auth(alice) })).statusCode).toBe(200);
    // повторное удаление идемпотентно
    expect((await app.inject({ method: "DELETE", url, headers: auth(alice) })).statusCode).toBe(200);

    for (const token of [alice, bob]) {
      const history = await historyOf(token, conv.id);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ content: "", deleted: true });
    }
  });

  it("moves the list preview to the previous message when the last one is deleted", async () => {
    const alice = await registerAndLogin(app, "alice11");
    const bob = await registerAndLogin(app, "bob11");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    await send(app, alice, conv.id, "один");
    const second = (await send(app, alice, conv.id, "два")).json().message as { id: number };

    await app.inject({
      method: "DELETE",
      url: `/api/conversations/${conv.id}/messages/${second.id}`,
      headers: auth(alice),
    });

    const [item] = await listOf(bob);
    expect(item.lastMessage).toMatchObject({ content: "один", deleted: false });
    expect(item.unreadCount).toBe(1);
  });

  it("hides a conversation from the list when its only message is deleted", async () => {
    const alice = await registerAndLogin(app, "alice15");
    const bob = await registerAndLogin(app, "bob15");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const only = (await send(app, alice, conv.id, "ошибся")).json().message as { id: number };

    await app.inject({
      method: "DELETE",
      url: `/api/conversations/${conv.id}/messages/${only.id}`,
      headers: auth(alice),
    });

    expect(await listOf(alice)).toHaveLength(0);
    expect(await listOf(bob)).toHaveLength(0);

    // новое сообщение возвращает диалог в список
    await send(app, bob, conv.id, "привет");
    expect(await listOf(alice)).toHaveLength(1);
  });

  it("deletes a conversation only for me and revives it with new messages only", async () => {
    const alice = await registerAndLogin(app, "alice12");
    const bob = await registerAndLogin(app, "bob12");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    await send(app, alice, conv.id, "старое1");
    await send(app, alice, conv.id, "старое2");

    const del = await app.inject({
      method: "DELETE",
      url: `/api/conversations/${conv.id}?scope=me`,
      headers: auth(bob),
    });
    expect(del.statusCode).toBe(200);

    expect(await listOf(bob)).toHaveLength(0);
    expect(await historyOf(bob, conv.id)).toHaveLength(0);
    // у собеседника всё на месте
    expect(await listOf(alice)).toHaveLength(1);
    expect(await historyOf(alice, conv.id)).toHaveLength(2);

    await send(app, alice, conv.id, "новое");

    const bobList = await listOf(bob);
    expect(bobList).toHaveLength(1);
    expect(bobList[0].lastMessage.content).toBe("новое");
    expect(bobList[0].unreadCount).toBe(1);
    expect((await historyOf(bob, conv.id)).map((m) => m.content)).toEqual(["новое"]);
    expect(await historyOf(alice, conv.id)).toHaveLength(3);
  });

  it("deletes a conversation for everyone and starts a fresh one afterwards", async () => {
    const alice = await registerAndLogin(app, "alice13");
    const bob = await registerAndLogin(app, "bob13");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    await send(app, bob, conv.id, "привет");

    const del = await app.inject({
      method: "DELETE",
      url: `/api/conversations/${conv.id}?scope=all`,
      headers: auth(alice),
    });
    expect(del.statusCode).toBe(200);

    expect(await listOf(alice)).toHaveLength(0);
    expect(await listOf(bob)).toHaveLength(0);
    for (const token of [alice, bob]) {
      const res = await app.inject({
        method: "GET",
        url: `/api/conversations/${conv.id}/messages`,
        headers: auth(token),
      });
      expect(res.statusCode).toBe(404);
      expect((await send(app, token, conv.id, "эй")).statusCode).toBe(404);
    }

    const fresh = await openConversation(app, bob, userIdFromToken(alice));
    expect(fresh.id).not.toBe(conv.id);
    expect(await historyOf(bob, fresh.id)).toHaveLength(0);
  });

  it("requires a valid scope and hides conversation deletion from a third user", async () => {
    const alice = await registerAndLogin(app, "alice14");
    const bob = await registerAndLogin(app, "bob14");
    const eve = await registerAndLogin(app, "eve14");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    await send(app, alice, conv.id, "привет");

    for (const q of ["", "?scope=nobody"]) {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/conversations/${conv.id}${q}`,
        headers: auth(alice),
      });
      expect(res.statusCode).toBe(400);
    }

    const foreign = await app.inject({
      method: "DELETE",
      url: `/api/conversations/${conv.id}?scope=all`,
      headers: auth(eve),
    });
    expect(foreign.statusCode).toBe(404);
    expect(await listOf(alice)).toHaveLength(1);
  });
});