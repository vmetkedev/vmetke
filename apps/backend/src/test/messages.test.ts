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

  const deleteMessage = (token: string, convId: number, msgId: number, scope?: string) =>
    app.inject({
      method: "DELETE",
      url: `/api/conversations/${convId}/messages/${msgId}${scope ? `?scope=${scope}` : ""}`,
      headers: auth(token),
    });

  it("deletes own message as a tombstone and forbids deleting others'", async () => {
    const alice = await registerAndLogin(app, "alice10");
    const bob = await registerAndLogin(app, "bob10");
    const eve = await registerAndLogin(app, "eve10");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "ошибся")).json().message as { id: number };
    const url = `/api/conversations/${conv.id}/messages/${msg.id}?scope=all`;

    expect((await app.inject({ method: "DELETE", url, headers: auth(bob) })).statusCode).toBe(403);
    expect((await app.inject({ method: "DELETE", url, headers: auth(eve) })).statusCode).toBe(404);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/conversations/${conv.id}/messages/999999?scope=all`,
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
      url: `/api/conversations/${conv.id}/messages/${second.id}?scope=all`,
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
      url: `/api/conversations/${conv.id}/messages/${only.id}?scope=all`,
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

  it("requires a valid scope when deleting a message", async () => {
    const alice = await registerAndLogin(app, "alice16");
    const bob = await registerAndLogin(app, "bob16");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "привет")).json().message as { id: number };

    expect((await deleteMessage(alice, conv.id, msg.id)).statusCode).toBe(400);
    expect((await deleteMessage(alice, conv.id, msg.id, "nobody")).statusCode).toBe(400);
    expect(await historyOf(alice, conv.id)).toHaveLength(1);
  });

  it("scope=me hides a message only for the one who deleted it", async () => {
    const alice = await registerAndLogin(app, "alice17");
    const bob = await registerAndLogin(app, "bob17");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "привет")).json().message as { id: number };

    expect((await deleteMessage(alice, conv.id, msg.id, "me")).statusCode).toBe(200);

    expect((await historyOf(alice, conv.id)).map((m) => m.id)).not.toContain(msg.id);
    // у собеседника сообщение живое, не «надгробие»
    expect(await historyOf(bob, conv.id)).toEqual([
      expect.objectContaining({ id: msg.id, content: "привет", deleted: false }),
    ]);
  });

  it("recipient can hide a foreign message for me but cannot delete it for everyone", async () => {
    const alice = await registerAndLogin(app, "alice18");
    const bob = await registerAndLogin(app, "bob18");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "от алисы")).json().message as { id: number };

    expect((await deleteMessage(bob, conv.id, msg.id, "all")).statusCode).toBe(403);
    expect(await historyOf(alice, conv.id)).toHaveLength(1);
    expect((await historyOf(alice, conv.id))[0].deleted).toBe(false);

    expect((await deleteMessage(bob, conv.id, msg.id, "me")).statusCode).toBe(200);
    expect(await historyOf(bob, conv.id)).toHaveLength(0);
    expect(await historyOf(alice, conv.id)).toHaveLength(1);
  });

  it("scope=me is idempotent and not available to a third user", async () => {
    const alice = await registerAndLogin(app, "alice19");
    const bob = await registerAndLogin(app, "bob19");
    const eve = await registerAndLogin(app, "eve19");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "привет")).json().message as { id: number };

    expect((await deleteMessage(alice, conv.id, msg.id, "me")).statusCode).toBe(200);
    expect((await deleteMessage(alice, conv.id, msg.id, "me")).statusCode).toBe(200);
    expect((await deleteMessage(eve, conv.id, msg.id, "me")).statusCode).toBe(404);
    expect((await deleteMessage(alice, conv.id, 999999, "me")).statusCode).toBe(404);
  });

  it("hiding the last message for me moves only my preview to the previous one", async () => {
    const alice = await registerAndLogin(app, "alice20");
    const bob = await registerAndLogin(app, "bob20");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    await send(app, alice, conv.id, "один");
    const second = (await send(app, alice, conv.id, "два")).json().message as { id: number };

    await deleteMessage(bob, conv.id, second.id, "me");

    const [bobItem] = await listOf(bob);
    expect(bobItem.lastMessage).toMatchObject({ content: "один", deleted: false });
    expect(bobItem.unreadCount).toBe(1);

    const [aliceItem] = await listOf(alice);
    expect(aliceItem.lastMessage.content).toBe("два");
  });

  it("hiding every message for me removes the dialog from my list only", async () => {
    const alice = await registerAndLogin(app, "alice21");
    const bob = await registerAndLogin(app, "bob21");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "единственное")).json().message as { id: number };

    await deleteMessage(bob, conv.id, msg.id, "me");

    expect(await listOf(bob)).toHaveLength(0);
    expect(await listOf(alice)).toHaveLength(1);

    // новое сообщение возвращает диалог, скрытое старое не возвращается
    await send(app, alice, conv.id, "ещё");
    const bobList = await listOf(bob);
    expect(bobList).toHaveLength(1);
    expect(bobList[0].lastMessage.content).toBe("ещё");
    expect((await historyOf(bob, conv.id)).map((m) => m.content)).toEqual(["ещё"]);
  });

  it("a message hidden for me and then deleted for everyone stays hidden for me", async () => {
    const alice = await registerAndLogin(app, "alice22");
    const bob = await registerAndLogin(app, "bob22");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "привет")).json().message as { id: number };

    await deleteMessage(alice, conv.id, msg.id, "me");
    expect((await deleteMessage(alice, conv.id, msg.id, "all")).statusCode).toBe(200);

    expect(await historyOf(alice, conv.id)).toHaveLength(0);
    expect((await historyOf(bob, conv.id))[0]).toMatchObject({ content: "", deleted: true });
  });

  type Quote = { id: number; senderId: string | null; content: string; deleted: boolean } | null;

  const quotesOf = async (token: string, convId: number) =>
    (await historyOf(token, convId)) as unknown as { id: number; replyTo: Quote }[];

  const sendReply = (token: string, convId: number, content: string, replyToId: unknown) =>
    app.inject({
      method: "POST",
      url: `/api/conversations/${convId}/messages`,
      headers: auth(token),
      payload: { content, replyToId },
    });

  it("sends a reply and returns a quote preview", async () => {
    const alice = await registerAndLogin(app, "alice23");
    const bob = await registerAndLogin(app, "bob23");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const orig = (await send(app, alice, conv.id, "оригинал")).json().message as { id: number };

    const res = await sendReply(bob, conv.id, "ответ", orig.id);
    expect(res.statusCode).toBe(201);
    expect(res.json().message.replyTo).toEqual({
      id: orig.id,
      senderId: userIdFromToken(alice),
      content: "оригинал",
      deleted: false,
    });

    for (const token of [alice, bob]) {
      const history = await quotesOf(token, conv.id);
      expect(history.find((m) => m.id === res.json().message.id)?.replyTo).toMatchObject({
        id: orig.id,
        content: "оригинал",
      });
      expect(history.find((m) => m.id === orig.id)?.replyTo).toBeNull();
    }
  });

  it("validates replyToId", async () => {
    const alice = await registerAndLogin(app, "alice24");
    const bob = await registerAndLogin(app, "bob24");
    const carol = await registerAndLogin(app, "carol24");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const other = await openConversation(app, alice, userIdFromToken(carol));
    const foreign = (await send(app, alice, other.id, "в другом диалоге")).json().message as {
      id: number;
    };

    for (const bad of [0, -1, "abc", 1.5]) {
      expect((await sendReply(alice, conv.id, "x", bad)).statusCode).toBe(400);
    }
    expect((await sendReply(alice, conv.id, "x", 999999)).statusCode).toBe(404);
    // сообщение из другого диалога
    expect((await sendReply(alice, conv.id, "x", foreign.id)).statusCode).toBe(404);
    expect(await historyOf(alice, conv.id)).toHaveLength(0);
  });

  it("cannot reply to a message deleted for everyone or hidden for me", async () => {
    const alice = await registerAndLogin(app, "alice25");
    const bob = await registerAndLogin(app, "bob25");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const gone = (await send(app, alice, conv.id, "удалю")).json().message as { id: number };
    const hidden = (await send(app, alice, conv.id, "скрою")).json().message as { id: number };

    await deleteMessage(alice, conv.id, gone.id, "all");
    await deleteMessage(bob, conv.id, hidden.id, "me");

    expect((await sendReply(bob, conv.id, "x", gone.id)).statusCode).toBe(404);
    expect((await sendReply(bob, conv.id, "x", hidden.id)).statusCode).toBe(404);
    // у автора это сообщение не скрыто, ему ответить на него можно
    expect((await sendReply(alice, conv.id, "x", hidden.id)).statusCode).toBe(201);
  });

  it("a quote turns into «deleted» when the original is deleted for everyone", async () => {
    const alice = await registerAndLogin(app, "alice26");
    const bob = await registerAndLogin(app, "bob26");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const orig = (await send(app, alice, conv.id, "секрет")).json().message as { id: number };
    const reply = (await sendReply(bob, conv.id, "ответ", orig.id)).json().message as { id: number };

    await deleteMessage(alice, conv.id, orig.id, "all");

    for (const token of [alice, bob]) {
      const quote = (await quotesOf(token, conv.id)).find((m) => m.id === reply.id)?.replyTo;
      expect(quote).toEqual({ id: orig.id, senderId: null, content: "", deleted: true });
    }
  });

  it("a quote of a message hidden for me looks deleted only for me", async () => {
    const alice = await registerAndLogin(app, "alice27");
    const bob = await registerAndLogin(app, "bob27");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const orig = (await send(app, alice, conv.id, "оригинал")).json().message as { id: number };
    const reply = (await sendReply(bob, conv.id, "ответ", orig.id)).json().message as { id: number };

    await deleteMessage(bob, conv.id, orig.id, "me");

    const forBob = (await quotesOf(bob, conv.id)).find((m) => m.id === reply.id)?.replyTo;
    expect(forBob).toMatchObject({ deleted: true, content: "" });
    const forAlice = (await quotesOf(alice, conv.id)).find((m) => m.id === reply.id)?.replyTo;
    expect(forAlice).toMatchObject({ deleted: false, content: "оригинал" });
  });

  it("truncates long quotes", async () => {
    const alice = await registerAndLogin(app, "alice28");
    const bob = await registerAndLogin(app, "bob28");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const orig = (await send(app, alice, conv.id, "я".repeat(300))).json().message as { id: number };

    const res = await sendReply(bob, conv.id, "ответ", orig.id);
    expect(res.json().message.replyTo.content).toBe("я".repeat(140));
  });

  it("a conversation cleared for me turns older quotes into «deleted»", async () => {
    const alice = await registerAndLogin(app, "alice29");
    const bob = await registerAndLogin(app, "bob29");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const orig = (await send(app, alice, conv.id, "старое")).json().message as { id: number };

    await app.inject({
      method: "DELETE",
      url: `/api/conversations/${conv.id}?scope=me`,
      headers: auth(bob),
    });
    // Алиса отвечает на старое, Боб старой истории не видит
    const reply = (await sendReply(alice, conv.id, "ответ", orig.id)).json().message as {
      id: number;
    };

    const quote = (await quotesOf(bob, conv.id)).find((m) => m.id === reply.id)?.replyTo;
    expect(quote).toEqual({ id: orig.id, senderId: null, content: "", deleted: true });
  });

  const editMsg = (token: string, convId: number, msgId: number, content: unknown) =>
    app.inject({
      method: "POST",
      url: `/api/conversations/${convId}/messages/${msgId}/edit`,
      headers: auth(token),
      payload: { content },
    });

  type Edited = { id: number; content: string; editedAt: string | null };
  const editedOf = async (token: string, convId: number) =>
    (await historyOf(token, convId)) as unknown as Edited[];

  it("edits own message and marks it as edited for both sides", async () => {
    const alice = await registerAndLogin(app, "alice30");
    const bob = await registerAndLogin(app, "bob30");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const orig = (await send(app, alice, conv.id, "опечатка")).json().message as { id: number };
    const other = (await send(app, alice, conv.id, "другое")).json().message as { id: number };

    const res = await editMsg(alice, conv.id, orig.id, "  исправлено  ");
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toMatchObject({ id: orig.id, content: "исправлено" });
    expect(res.json().message.editedAt).not.toBeNull();

    for (const token of [alice, bob]) {
      const history = await editedOf(token, conv.id);
      const edited = history.find((m) => m.id === orig.id);
      expect(edited?.content).toBe("исправлено");
      expect(edited?.editedAt).not.toBeNull();
      // нетронутое сообщение остаётся без отметки
      expect(history.find((m) => m.id === other.id)?.editedAt).toBeNull();
    }
  });

  it("edit of the last message updates the list preview", async () => {
    const alice = await registerAndLogin(app, "alice31");
    const bob = await registerAndLogin(app, "bob31");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "было")).json().message as { id: number };

    await editMsg(alice, conv.id, msg.id, "стало");

    const [item] = await listOf(bob);
    expect(item.lastMessage.content).toBe("стало");
  });

  it("only the author can edit; third users, missing, deleted and hidden messages give 404", async () => {
    const alice = await registerAndLogin(app, "alice32");
    const bob = await registerAndLogin(app, "bob32");
    const eve = await registerAndLogin(app, "eve32");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "моё")).json().message as { id: number };
    const gone = (await send(app, alice, conv.id, "удалю")).json().message as { id: number };
    const hidden = (await send(app, alice, conv.id, "скрою")).json().message as { id: number };

    await deleteMessage(alice, conv.id, gone.id, "all");
    await deleteMessage(alice, conv.id, hidden.id, "me");

    expect((await editMsg(bob, conv.id, msg.id, "чужое")).statusCode).toBe(403);
    expect((await editMsg(eve, conv.id, msg.id, "чужое")).statusCode).toBe(404);
    expect((await editMsg(alice, conv.id, 999999, "x")).statusCode).toBe(404);
    expect((await editMsg(alice, conv.id, gone.id, "x")).statusCode).toBe(404);
    expect((await editMsg(alice, conv.id, hidden.id, "x")).statusCode).toBe(404);

    // оригинал не пострадал
    expect((await editedOf(bob, conv.id)).find((m) => m.id === msg.id)?.content).toBe("моё");
  });

  it("validates the edited content", async () => {
    const alice = await registerAndLogin(app, "alice33");
    const bob = await registerAndLogin(app, "bob33");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "текст")).json().message as { id: number };

    for (const bad of ["", "   ", "x".repeat(5001), 123, undefined]) {
      expect((await editMsg(alice, conv.id, msg.id, bad)).statusCode).toBe(400);
    }
    expect((await editedOf(alice, conv.id))[0]).toMatchObject({ content: "текст", editedAt: null });
  });

  it("an unchanged text does not set the edited mark", async () => {
    const alice = await registerAndLogin(app, "alice34");
    const bob = await registerAndLogin(app, "bob34");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "то же")).json().message as { id: number };

    const res = await editMsg(alice, conv.id, msg.id, "  то же  ");
    expect(res.statusCode).toBe(200);
    expect(res.json().message.editedAt).toBeNull();
    expect((await editedOf(bob, conv.id))[0].editedAt).toBeNull();
  });

  it("editing is forbidden when the pair is blocked", async () => {
    const alice = await registerAndLogin(app, "alice35");
    const bob = await registerAndLogin(app, "bob35");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const msg = (await send(app, alice, conv.id, "до блокировки")).json().message as { id: number };

    await app.inject({
      method: "POST",
      url: "/api/blocks",
      headers: auth(bob),
      payload: { userId: userIdFromToken(alice) },
    });

    expect((await editMsg(alice, conv.id, msg.id, "после")).statusCode).toBe(403);
    expect((await editedOf(bob, conv.id))[0].content).toBe("до блокировки");
  });

  it("a quote shows the actual text after the original is edited", async () => {
    const alice = await registerAndLogin(app, "alice36");
    const bob = await registerAndLogin(app, "bob36");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const orig = (await send(app, alice, conv.id, "старый текст")).json().message as { id: number };
    const reply = (await sendReply(bob, conv.id, "ответ", orig.id)).json().message as { id: number };

    await editMsg(alice, conv.id, orig.id, "новый текст");

    const quote = (await quotesOf(bob, conv.id)).find((m) => m.id === reply.id)?.replyTo;
    expect(quote).toMatchObject({ id: orig.id, content: "новый текст", deleted: false });
  });

  it("editing a reply keeps its quote", async () => {
    const alice = await registerAndLogin(app, "alice37");
    const bob = await registerAndLogin(app, "bob37");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const orig = (await send(app, alice, conv.id, "вопрос")).json().message as { id: number };
    const reply = (await sendReply(bob, conv.id, "ответ", orig.id)).json().message as { id: number };

    const res = await editMsg(bob, conv.id, reply.id, "уточнённый ответ");
    expect(res.statusCode).toBe(200);
    expect(res.json().message.replyTo).toMatchObject({ id: orig.id, content: "вопрос" });
  });

  const forwardMsg = (token: string, convId: number, msgId: number, to: unknown) =>
    app.inject({
      method: "POST",
      url: `/api/conversations/${convId}/messages/${msgId}/forward`,
      headers: auth(token),
      payload: { toConversationId: to },
    });

  type Fwd = {
    id: number;
    content: string;
    editedAt: string | null;
    replyTo: unknown;
    forwardedFrom: { id: string; username: string } | null;
  };
  const fwdOf = async (token: string, convId: number) =>
    (await historyOf(token, convId)) as unknown as Fwd[];

  it("forwards a message to another conversation with the original author", async () => {
    const alice = await registerAndLogin(app, "alice40");
    const bob = await registerAndLogin(app, "bob40");
    const carol = await registerAndLogin(app, "carol40");
    const c1 = await openConversation(app, alice, userIdFromToken(bob));
    const c2 = await openConversation(app, alice, userIdFromToken(carol));
    const orig = (await send(app, bob, c1.id, "привет")).json().message as { id: number };

    const res = await forwardMsg(alice, c1.id, orig.id, c2.id);
    expect(res.statusCode).toBe(201);
    expect(res.json().message).toMatchObject({
      conversationId: c2.id,
      senderId: userIdFromToken(alice),
      content: "привет",
      deleted: false,
      editedAt: null,
      replyTo: null,
      forwardedFrom: { id: userIdFromToken(bob), username: "bob40" },
    });

    const [copy] = await fwdOf(carol, c2.id);
    expect(copy).toMatchObject({ content: "привет", forwardedFrom: { username: "bob40" } });
    const [item] = await listOf(carol);
    expect(item.lastMessage.content).toBe("привет");
    expect(item.unreadCount).toBe(1);

    // оригинал не тронут
    const original = await fwdOf(bob, c1.id);
    expect(original).toHaveLength(1);
    expect(original[0].forwardedFrom).toBeNull();
  });

  it("forwarding your own message marks yourself as the author", async () => {
    const alice = await registerAndLogin(app, "alice41");
    const bob = await registerAndLogin(app, "bob41");
    const carol = await registerAndLogin(app, "carol41");
    const c1 = await openConversation(app, alice, userIdFromToken(bob));
    const c2 = await openConversation(app, alice, userIdFromToken(carol));
    const orig = (await send(app, alice, c1.id, "моё")).json().message as { id: number };

    const res = await forwardMsg(alice, c1.id, orig.id, c2.id);
    expect(res.statusCode).toBe(201);
    expect(res.json().message.forwardedFrom).toMatchObject({ id: userIdFromToken(alice) });
  });

  it("forwarding a forwarded message keeps the first author", async () => {
    const alice = await registerAndLogin(app, "alice42");
    const bob = await registerAndLogin(app, "bob42");
    const carol = await registerAndLogin(app, "carol42");
    const dave = await registerAndLogin(app, "dave42");
    const c1 = await openConversation(app, alice, userIdFromToken(bob));
    const c2 = await openConversation(app, alice, userIdFromToken(carol));
    const c3 = await openConversation(app, alice, userIdFromToken(dave));
    const orig = (await send(app, bob, c1.id, "эстафета")).json().message as { id: number };

    const first = (await forwardMsg(alice, c1.id, orig.id, c2.id)).json().message as { id: number };
    const second = await forwardMsg(alice, c2.id, first.id, c3.id);

    expect(second.statusCode).toBe(201);
    expect(second.json().message.forwardedFrom).toMatchObject({ id: userIdFromToken(bob) });
  });

  it("can forward into the same conversation", async () => {
    const alice = await registerAndLogin(app, "alice43");
    const bob = await registerAndLogin(app, "bob43");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const orig = (await send(app, bob, conv.id, "повтор")).json().message as { id: number };

    const res = await forwardMsg(alice, conv.id, orig.id, conv.id);
    expect(res.statusCode).toBe(201);
    expect(await fwdOf(alice, conv.id)).toHaveLength(2);
  });

  it("validates forward input and hides foreign conversations", async () => {
    const alice = await registerAndLogin(app, "alice44");
    const bob = await registerAndLogin(app, "bob44");
    const carol = await registerAndLogin(app, "carol44");
    const eve = await registerAndLogin(app, "eve44");
    const c1 = await openConversation(app, alice, userIdFromToken(bob));
    const foreign = await openConversation(app, eve, userIdFromToken(carol));
    const orig = (await send(app, alice, c1.id, "текст")).json().message as { id: number };

    for (const bad of [undefined, 0, -1, "x", 1.5]) {
      expect((await forwardMsg(alice, c1.id, orig.id, bad)).statusCode).toBe(400);
    }
    expect((await forwardMsg(alice, c1.id, 999999, c1.id)).statusCode).toBe(404);
    // чужой и несуществующий диалоги получателя
    expect((await forwardMsg(alice, c1.id, orig.id, foreign.id)).statusCode).toBe(404);
    expect((await forwardMsg(alice, c1.id, orig.id, 999999)).statusCode).toBe(404);
    expect(await fwdOf(carol, foreign.id)).toHaveLength(0);

    // посторонний не может пересылать из чужого диалога
    expect((await forwardMsg(eve, c1.id, orig.id, foreign.id)).statusCode).toBe(404);
    expect(await fwdOf(carol, foreign.id)).toHaveLength(0);
  });

  it("cannot forward a message deleted for everyone or hidden for me", async () => {
    const alice = await registerAndLogin(app, "alice45");
    const bob = await registerAndLogin(app, "bob45");
    const carol = await registerAndLogin(app, "carol45");
    const c1 = await openConversation(app, alice, userIdFromToken(bob));
    const c2 = await openConversation(app, alice, userIdFromToken(carol));
    const gone = (await send(app, bob, c1.id, "удалю")).json().message as { id: number };
    const hidden = (await send(app, bob, c1.id, "скрою")).json().message as { id: number };

    await deleteMessage(bob, c1.id, gone.id, "all");
    await deleteMessage(alice, c1.id, hidden.id, "me");

    expect((await forwardMsg(alice, c1.id, gone.id, c2.id)).statusCode).toBe(404);
    expect((await forwardMsg(alice, c1.id, hidden.id, c2.id)).statusCode).toBe(404);
    expect(await fwdOf(carol, c2.id)).toHaveLength(0);
  });

  it("cannot forward a message from a history cleared for me", async () => {
    const alice = await registerAndLogin(app, "alice46");
    const bob = await registerAndLogin(app, "bob46");
    const carol = await registerAndLogin(app, "carol46");
    const c1 = await openConversation(app, alice, userIdFromToken(bob));
    const c2 = await openConversation(app, alice, userIdFromToken(carol));
    const old = (await send(app, bob, c1.id, "старое")).json().message as { id: number };

    await app.inject({
      method: "DELETE",
      url: `/api/conversations/${c1.id}?scope=me`,
      headers: auth(alice),
    });

    expect((await forwardMsg(alice, c1.id, old.id, c2.id)).statusCode).toBe(404);
    expect(await fwdOf(carol, c2.id)).toHaveLength(0);
  });

  it("cannot forward into a blocked conversation", async () => {
    const alice = await registerAndLogin(app, "alice47");
    const bob = await registerAndLogin(app, "bob47");
    const carol = await registerAndLogin(app, "carol47");
    const c1 = await openConversation(app, alice, userIdFromToken(bob));
    const c2 = await openConversation(app, alice, userIdFromToken(carol));
    const orig = (await send(app, bob, c1.id, "текст")).json().message as { id: number };

    await app.inject({
      method: "POST",
      url: "/api/blocks",
      headers: auth(alice),
      payload: { userId: userIdFromToken(carol) },
    });

    expect((await forwardMsg(alice, c1.id, orig.id, c2.id)).statusCode).toBe(403);
    expect(await fwdOf(carol, c2.id)).toHaveLength(0);
  });

  it("the copy drops the quote and the edited mark", async () => {
    const alice = await registerAndLogin(app, "alice48");
    const bob = await registerAndLogin(app, "bob48");
    const carol = await registerAndLogin(app, "carol48");
    const c1 = await openConversation(app, alice, userIdFromToken(bob));
    const c2 = await openConversation(app, alice, userIdFromToken(carol));
    const question = (await send(app, bob, c1.id, "вопрос")).json().message as { id: number };
    const answer = (await sendReply(alice, c1.id, "ответ", question.id)).json().message as {
      id: number;
    };
    await editMsg(alice, c1.id, answer.id, "ответ, уточнённый");

    const res = await forwardMsg(alice, c1.id, answer.id, c2.id);
    expect(res.statusCode).toBe(201);
    expect(res.json().message).toMatchObject({
      content: "ответ, уточнённый",
      replyTo: null,
      editedAt: null,
    });
  });

  it("a forwarded message cannot be edited", async () => {
    const alice = await registerAndLogin(app, "alice49");
    const bob = await registerAndLogin(app, "bob49");
    const carol = await registerAndLogin(app, "carol49");
    const c1 = await openConversation(app, alice, userIdFromToken(bob));
    const c2 = await openConversation(app, alice, userIdFromToken(carol));
    const orig = (await send(app, bob, c1.id, "оригинал")).json().message as { id: number };
    const copy = (await forwardMsg(alice, c1.id, orig.id, c2.id)).json().message as { id: number };

    expect((await editMsg(alice, c2.id, copy.id, "подмена")).statusCode).toBe(400);
    expect((await fwdOf(carol, c2.id))[0]).toMatchObject({ content: "оригинал", editedAt: null });
  });

    const likeMsg = (token: string, convId: number, msgId: number) =>
    app.inject({
      method: "POST",
      url: `/api/conversations/${convId}/messages/${msgId}/like`,
      headers: auth(token),
    });

  const unlikeMsg = (token: string, convId: number, msgId: number) =>
    app.inject({
      method: "DELETE",
      url: `/api/conversations/${convId}/messages/${msgId}/like`,
      headers: auth(token),
    });

  type Likes = { count: number; likedByMe: boolean };
  const likesOfMsg = async (token: string, convId: number, msgId: number) =>
    ((await historyOf(token, convId)) as unknown as { id: number; likes: Likes }[]).find(
      (m) => m.id === msgId,
    )?.likes;

  it("likes are per user and each viewer sees their own flag", async () => {
    const alice = await registerAndLogin(app, "alice50");
    const bob = await registerAndLogin(app, "bob50");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const m = (await send(app, bob, conv.id, "нравится")).json().message as { id: number };

    const first = await likeMsg(alice, conv.id, m.id);
    expect(first.statusCode).toBe(200);
    expect(first.json().likes).toEqual({ count: 1, likedByMe: true });
    expect(await likesOfMsg(alice, conv.id, m.id)).toEqual({ count: 1, likedByMe: true });
    expect(await likesOfMsg(bob, conv.id, m.id)).toEqual({ count: 1, likedByMe: false });

    // можно лайкнуть и своё сообщение
    expect((await likeMsg(bob, conv.id, m.id)).json().likes).toEqual({ count: 2, likedByMe: true });
    expect(await likesOfMsg(alice, conv.id, m.id)).toEqual({ count: 2, likedByMe: true });

    const removed = await unlikeMsg(alice, conv.id, m.id);
    expect(removed.json().likes).toEqual({ count: 1, likedByMe: false });
    expect(await likesOfMsg(bob, conv.id, m.id)).toEqual({ count: 1, likedByMe: true });
  });

  it("a new message has no likes, and like/unlike are idempotent", async () => {
    const alice = await registerAndLogin(app, "alice51");
    const bob = await registerAndLogin(app, "bob51");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const sent = await send(app, bob, conv.id, "привет");
    const m = sent.json().message as { id: number; likes: Likes };
    expect(m.likes).toEqual({ count: 0, likedByMe: false });

    await likeMsg(alice, conv.id, m.id);
    expect((await likeMsg(alice, conv.id, m.id)).json().likes).toEqual({
      count: 1,
      likedByMe: true,
    });

    await unlikeMsg(alice, conv.id, m.id);
    const again = await unlikeMsg(alice, conv.id, m.id);
    expect(again.statusCode).toBe(200);
    expect(again.json().likes).toEqual({ count: 0, likedByMe: false });
  });

  it("likes need a visible message in my own conversation", async () => {
    const alice = await registerAndLogin(app, "alice52");
    const bob = await registerAndLogin(app, "bob52");
    const eve = await registerAndLogin(app, "eve52");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const live = (await send(app, bob, conv.id, "живое")).json().message as { id: number };
    const gone = (await send(app, bob, conv.id, "удалю")).json().message as { id: number };
    const hidden = (await send(app, bob, conv.id, "скрою")).json().message as { id: number };

    await deleteMessage(bob, conv.id, gone.id, "all");
    await deleteMessage(alice, conv.id, hidden.id, "me");

    expect((await likeMsg(eve, conv.id, live.id)).statusCode).toBe(404);
    expect((await unlikeMsg(eve, conv.id, live.id)).statusCode).toBe(404);
    expect((await likeMsg(alice, conv.id, 999999)).statusCode).toBe(404);
    expect((await likeMsg(alice, conv.id, gone.id)).statusCode).toBe(404);
    expect((await likeMsg(alice, conv.id, hidden.id)).statusCode).toBe(404);
    expect((await unlikeMsg(alice, conv.id, hidden.id)).statusCode).toBe(404);

    const bad = await app.inject({
      method: "POST",
      url: `/api/conversations/${conv.id}/messages/abc/like`,
      headers: auth(alice),
    });
    expect(bad.statusCode).toBe(400);
    expect(await likesOfMsg(bob, conv.id, live.id)).toEqual({ count: 0, likedByMe: false });
  });

  it("cannot like in a blocked pair, but can remove an existing like", async () => {
    const alice = await registerAndLogin(app, "alice53");
    const bob = await registerAndLogin(app, "bob53");
    const conv = await openConversation(app, alice, userIdFromToken(bob));
    const m1 = (await send(app, bob, conv.id, "первое")).json().message as { id: number };
    const m2 = (await send(app, bob, conv.id, "второе")).json().message as { id: number };
    await likeMsg(alice, conv.id, m1.id);

    await app.inject({
      method: "POST",
      url: "/api/blocks",
      headers: auth(bob),
      payload: { userId: userIdFromToken(alice) },
    });

    expect((await likeMsg(alice, conv.id, m2.id)).statusCode).toBe(403);
    const removed = await unlikeMsg(alice, conv.id, m1.id);
    expect(removed.statusCode).toBe(200);
    expect(removed.json().likes).toEqual({ count: 0, likedByMe: false });
  });

  it("likes survive an edit and are not copied by a forward", async () => {
    const alice = await registerAndLogin(app, "alice54");
    const bob = await registerAndLogin(app, "bob54");
    const carol = await registerAndLogin(app, "carol54");
    const c1 = await openConversation(app, alice, userIdFromToken(bob));
    const c2 = await openConversation(app, alice, userIdFromToken(carol));
    const m = (await send(app, bob, c1.id, "до правки")).json().message as { id: number };
    await likeMsg(alice, c1.id, m.id);

    const edited = await editMsg(bob, c1.id, m.id, "после правки");
    expect(edited.json().message.likes).toEqual({ count: 1, likedByMe: false });

    const copy = await forwardMsg(alice, c1.id, m.id, c2.id);
    expect(copy.json().message.likes).toEqual({ count: 0, likedByMe: false });
  });
});