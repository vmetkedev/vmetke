import type { ServerResponse } from "node:http";

export type RealtimeEvent = {
  type:
    | "message.new"
    | "message.edited"
    | "message.deleted"
    | "message.like"
    | "conversation.read"
    | "conversation.deleted"
    | "block.changed";
  conversationId?: number;
};

export const MAX_CONNECTIONS_PER_USER = 5;
export const HEARTBEAT_MS = 25_000;

// userId -> открытые SSE-соединения (Set хранит порядок вставки: старейшее первым)
const clients = new Map<string, Set<ServerResponse>>();
let heartbeat: NodeJS.Timeout | null = null;

function safeWrite(res: ServerResponse, chunk: string): boolean {
  try {
    if (res.writableEnded || res.destroyed) return false;
    res.write(chunk);
    return true;
  } catch {
    return false;
  }
}

function stopHeartbeatIfIdle() {
  if (clients.size === 0 && heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

function detach(userId: string, res: ServerResponse) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userId);
  stopHeartbeatIfIdle();
}

function startHeartbeat() {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    for (const [userId, set] of clients) {
      for (const res of [...set]) {
        if (!safeWrite(res, ": ping\n\n")) detach(userId, res);
      }
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();
}

// Регистрирует соединение и возвращает функцию отписки (вызывать на close).
// Сверх лимита закрываем самое старое соединение: это обычно забытые вкладки.
export function addClient(userId: string, res: ServerResponse): () => void {
  let set = clients.get(userId);
  if (!set) {
    set = new Set();
    clients.set(userId, set);
  }
  while (set.size >= MAX_CONNECTIONS_PER_USER) {
    const oldest = set.values().next().value;
    if (!oldest) break;
    set.delete(oldest);
    oldest.end();
  }
  set.add(res);
  startHeartbeat();
  return () => detach(userId, res);
}

// Сигнал «что-то изменилось». Без текста сообщений: клиент перезапрашивает данные
// обычными эндпоинтами, где уже учтены блокировки, скрытия и лайки зрителя.
export function publish(userIds: string[], event: RealtimeEvent) {
  const frame = `data: ${JSON.stringify(event)}\n\n`;
  for (const userId of new Set(userIds)) {
    const set = clients.get(userId);
    if (!set) continue;
    for (const res of [...set]) {
      if (!safeWrite(res, frame)) detach(userId, res);
    }
  }
}

// Для бана и удаления аккаунта: рвём все соединения пользователя
export function disconnectUser(userId: string) {
  const set = clients.get(userId);
  if (!set) return;
  clients.delete(userId);
  for (const res of set) res.end();
  stopHeartbeatIfIdle();
}

export function closeAllClients() {
  for (const set of clients.values()) for (const res of set) res.end();
  clients.clear();
  stopHeartbeatIfIdle();
}