import { api } from "./api";

export type ConversationUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarColor: number | null;
};

export type Message = {
  id: number;
  conversationId: number;
  senderId: string;
  content: string;
  createdAt: string;
};

export type Conversation = {
  id: number;
  otherUser: ConversationUser;
  lastMessage: { id: number; content: string; senderId: string; createdAt: string };
  unreadCount: number;
};

export const MAX_MESSAGE = 5000;
export const MESSAGES_CHANGED_EVENT = "messages:changed";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Ошибка запроса");
  }
  return res.json();
}

export async function fetchConversations(): Promise<{ conversations: Conversation[] }> {
  return parse(await api.get("/conversations"));
}

export async function openConversation(userId: string): Promise<{ id: number }> {
  const data = await parse<{ conversation: { id: number } }>(
    await api.post("/conversations", { userId }),
  );
  return data.conversation;
}

export async function fetchMessages(
  conversationId: number,
  before?: number,
): Promise<{ messages: Message[]; nextCursor: number | null }> {
  const qs = before ? `?before=${before}` : "";
  return parse(await api.get(`/conversations/${conversationId}/messages${qs}`));
}

export async function sendMessage(conversationId: number, content: string): Promise<Message> {
  const data = await parse<{ message: Message }>(
    await api.post(`/conversations/${conversationId}/messages`, { content }),
  );
  window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
  return data.message;
}

export async function markConversationRead(conversationId: number): Promise<void> {
  await parse(await api.post(`/conversations/${conversationId}/read`));
  window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
}