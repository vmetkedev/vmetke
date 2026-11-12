import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { api } from "./api";
import {
  MESSAGES_CHANGED_EVENT,
  deleteConversation,
  deleteMessage,
  editMessage,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  openConversation,
  sendMessage,
  forwardMessage,
  likeMessage,
  unlikeMessage,
} from "./messages";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

describe("lib/messages", () => {
  const onChanged = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    window.addEventListener(MESSAGES_CHANGED_EVENT, onChanged);
  });

  afterEach(() => {
    window.removeEventListener(MESSAGES_CHANGED_EVENT, onChanged);
  });

  it("fetchConversations запрашивает список диалогов", async () => {
    const data = { conversations: [{ id: 1 }] };
    vi.mocked(api.get).mockResolvedValue(json(data));

    await expect(fetchConversations()).resolves.toEqual(data);
    expect(api.get).toHaveBeenCalledWith("/conversations");
  });

  it("openConversation отправляет userId и возвращает диалог", async () => {
    vi.mocked(api.post).mockResolvedValue(json({ conversation: { id: 7 } }));

    await expect(openConversation("user-uuid")).resolves.toEqual({ id: 7 });
    expect(api.post).toHaveBeenCalledWith("/conversations", { userId: "user-uuid" });
  });

  it("fetchMessages без курсора не добавляет query-параметр", async () => {
    const data = { messages: [], nextCursor: null };
    vi.mocked(api.get).mockResolvedValue(json(data));

    await expect(fetchMessages(5)).resolves.toEqual(data);
    expect(api.get).toHaveBeenCalledWith("/conversations/5/messages");
  });

  it("fetchMessages с курсором передаёт before", async () => {
    vi.mocked(api.get).mockResolvedValue(json({ messages: [], nextCursor: null }));

    await fetchMessages(5, 42);
    expect(api.get).toHaveBeenCalledWith("/conversations/5/messages?before=42");
  });

  it("sendMessage отправляет текст, возвращает сообщение и шлёт событие", async () => {
    const message = { id: 1, conversationId: 5, senderId: "me", content: "привет", createdAt: "x" };
    vi.mocked(api.post).mockResolvedValue(json({ message }, 201));

    await expect(sendMessage(5, "привет")).resolves.toEqual(message);
    expect(api.post).toHaveBeenCalledWith("/conversations/5/messages", { content: "привет" });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("sendMessage с replyToId передаёт его в теле запроса", async () => {
    const message = { id: 2, conversationId: 5, senderId: "me", content: "ответ", createdAt: "x" };
    vi.mocked(api.post).mockResolvedValue(json({ message }, 201));

    await expect(sendMessage(5, "ответ", 3)).resolves.toEqual(message);
    expect(api.post).toHaveBeenCalledWith("/conversations/5/messages", {
      content: "ответ",
      replyToId: 3,
    });
  });

  it("editMessage отправляет новый текст на /edit, возвращает сообщение и шлёт событие", async () => {
    const message = { id: 3, conversationId: 5, senderId: "me", content: "новое", createdAt: "x", editedAt: "y" };
    vi.mocked(api.post).mockResolvedValue(json({ message }));

    await expect(editMessage(5, 3, "новое")).resolves.toEqual(message);
    expect(api.post).toHaveBeenCalledWith("/conversations/5/messages/3/edit", { content: "новое" });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("likeMessage ставит лайк на /like, возвращает лайки и не шлёт событие", async () => {
    vi.mocked(api.post).mockResolvedValue(json({ likes: { count: 1, likedByMe: true } }));

    await expect(likeMessage(5, 3)).resolves.toEqual({ count: 1, likedByMe: true });
    expect(api.post).toHaveBeenCalledWith("/conversations/5/messages/3/like");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("unlikeMessage снимает лайк через DELETE и возвращает лайки", async () => {
    vi.mocked(api.delete).mockResolvedValue(json({ likes: { count: 0, likedByMe: false } }));

    await expect(unlikeMessage(5, 3)).resolves.toEqual({ count: 0, likedByMe: false });
    expect(api.delete).toHaveBeenCalledWith("/conversations/5/messages/3/like");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("forwardMessage отправляет id диалога-получателя на /forward, возвращает сообщение и шлёт событие", async () => {
    const message = { id: 9, conversationId: 6, senderId: "me", content: "текст", createdAt: "x" };
    vi.mocked(api.post).mockResolvedValue(json({ message }, 201));

    await expect(forwardMessage(5, 3, 6)).resolves.toEqual(message);
    expect(api.post).toHaveBeenCalledWith("/conversations/5/messages/3/forward", {
      toConversationId: 6,
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("sendMessage при ошибке не шлёт событие", async () => {
    vi.mocked(api.post).mockResolvedValue(json({ error: "Диалог не найден" }, 404));

    await expect(sendMessage(5, "привет")).rejects.toThrow("Диалог не найден");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("markConversationRead вызывает /read и шлёт событие", async () => {
    vi.mocked(api.post).mockResolvedValue(json({ success: true }));

    await markConversationRead(5);
    expect(api.post).toHaveBeenCalledWith("/conversations/5/read");
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("deleteMessage передаёт scope и шлёт событие", async () => {
    vi.mocked(api.delete).mockResolvedValue(json({ success: true }));

    await deleteMessage(5, 9, "me");
    expect(api.delete).toHaveBeenCalledWith("/conversations/5/messages/9?scope=me");
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("deleteConversation передаёт scope и шлёт событие", async () => {
    vi.mocked(api.delete).mockResolvedValue(json({ success: true }));

    await deleteConversation(5, "all");
    expect(api.delete).toHaveBeenCalledWith("/conversations/5?scope=all");
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("бросает сообщение об ошибке из тела ответа", async () => {
    vi.mocked(api.get).mockResolvedValue(json({ error: "Некорректные данные" }, 400));

    await expect(fetchConversations()).rejects.toThrow("Некорректные данные");
  });

  it("бросает запасное сообщение, если тело ответа не JSON", async () => {
    vi.mocked(api.get).mockResolvedValue(new Response("oops", { status: 500 }));

    await expect(fetchMessages(5)).rejects.toThrow("Ошибка запроса");
  });
});