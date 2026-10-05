import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from "./api";
import {
  MESSAGES_CHANGED_EVENT,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  openConversation,
  sendMessage,
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

  it("бросает сообщение об ошибке из тела ответа", async () => {
    vi.mocked(api.get).mockResolvedValue(json({ error: "Некорректные данные" }, 400));

    await expect(fetchConversations()).rejects.toThrow("Некорректные данные");
  });

  it("бросает запасное сообщение, если тело ответа не JSON", async () => {
    vi.mocked(api.get).mockResolvedValue(new Response("oops", { status: 500 }));

    await expect(fetchMessages(5)).rejects.toThrow("Ошибка запроса");
  });
});