import { api } from "./client";

export type RealtimeEvent = {
  type:
    | "message.new"
    | "message.edited"
    | "message.deleted"
    | "message.like"
    | "conversation.read"
    | "conversation.deleted"
    | "block.changed"
    | "notification.new"
    | "notification.changed"
    | "typing";
  conversationId?: number;
};

type EventHandler = (event: RealtimeEvent) => void;
type StatusHandler = (connected: boolean) => void;

const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 30000;
// Соединение, прожившее дольше, считается удачным: backoff сбрасывается
const STABLE_MS = 5000;
// Сервер шлёт heartbeat каждые 25 с; тишина дольше 60 с значит, что соединение мёртвое
const IDLE_TIMEOUT_MS = 60000;
// После ухода последнего подписчика ждём: при переходе между страницами он тут же вернётся
const GRACE_MS = 1500;

const subscribers = new Set<{ userId: string; handler: EventHandler }>();
const statusListeners = new Set<StatusHandler>();

let owner: string | null = null;
let abort: AbortController | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let connected = false;

export const isRealtimeConnected = () => connected;

export function subscribeStatus(listener: StatusHandler): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  for (const listener of [...statusListeners]) listener(value);
}

function dispatchFrame(frame: string) {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return; // комментарий (heartbeat)

  let event: RealtimeEvent;
  try {
    event = JSON.parse(data);
  } catch {
    return;
  }
  if (!event || typeof event.type !== "string") return;

  for (const s of [...subscribers]) {
    if (s.userId !== owner) continue;
    try {
      s.handler(event);
    } catch {
      // ошибка одного подписчика не должна ломать остальных
    }
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
  });
}

// true: сессия недействительна (401/403), повторять бессмысленно
async function connectOnce(signal: AbortSignal): Promise<boolean> {
  const conn = new AbortController();
  const onAbort = () => conn.abort();
  signal.addEventListener("abort", onAbort);

  let lastActivity = Date.now();
  const watchdog = setInterval(() => {
    if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) conn.abort();
  }, 10000);

  try {
    const res = await api.get("/events", {
      signal: conn.signal,
      headers: { Accept: "text/event-stream" },
    });
    if (res.status === 401 || res.status === 403) return true;
    if (!res.ok || !res.body || signal.aborted) return false;

    const reader = res.body.getReader();
    conn.signal.addEventListener("abort", () => void reader.cancel().catch(() => {}));
    const decoder = new TextDecoder();
    let buf = "";

    setConnected(true);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return false;
      lastActivity = Date.now();
      buf += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buf.indexOf("\n\n")) !== -1) {
        dispatchFrame(buf.slice(0, end));
        buf = buf.slice(end + 2);
      }
    }
  } finally {
    clearInterval(watchdog);
    signal.removeEventListener("abort", onAbort);
    conn.abort();
  }
}

async function run(signal: AbortSignal) {
  let delay = RETRY_MIN_MS;
  while (!signal.aborted) {
    const startedAt = Date.now();
    let fatal = false;
    try {
      fatal = await connectOnce(signal);
    } catch {
      // сеть или обрыв: уходим на повтор
    }
    // старый цикл не должен сбрасывать статус нового соединения
    if (abort?.signal === signal) setConnected(false);

    if (fatal) {
      if (abort?.signal === signal) stop();
      return;
    }
    if (signal.aborted) return;

    if (Date.now() - startedAt > STABLE_MS) delay = RETRY_MIN_MS;
    await sleep(delay + Math.random() * 500, signal);
    delay = Math.min(delay * 2, RETRY_MAX_MS);
  }
}

function stop() {
  abort?.abort();
  abort = null;
  owner = null;
  setConnected(false);
}

function ensureRunning(userId: string) {
  if (owner === userId && abort && !abort.signal.aborted) return;
  stop();
  owner = userId;
  abort = new AbortController();
  void run(abort.signal);
}

export function subscribeRealtime(userId: string, handler: EventHandler): () => void {
  const entry = { userId, handler };
  subscribers.add(entry);
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  ensureRunning(userId);

  return () => {
    subscribers.delete(entry);
    if (subscribers.size === 0 && !stopTimer) {
      stopTimer = setTimeout(() => {
        stopTimer = null;
        if (subscribers.size === 0) stop();
      }, GRACE_MS);
    }
  };
}

export function __resetRealtimeForTests() {
  subscribers.clear();
  statusListeners.clear();
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  stop();
}