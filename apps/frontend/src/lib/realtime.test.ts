import { afterEach, describe, expect, it, vi } from "vitest";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock("./api", () => ({ api: { get: getMock } }));

import {
  __resetRealtimeForTests,
  isRealtimeConnected,
  subscribeRealtime,
  subscribeStatus,
  type RealtimeEvent,
} from "./realtime";

function makeStream() {
  const enc = new TextEncoder();
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c;
    },
  });
  return {
    response: new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }),
    push: (s: string) => ctrl.enqueue(enc.encode(s)),
    close: () => ctrl.close(),
  };
}

const signalOf = (call: number) => getMock.mock.calls[call][1].signal as AbortSignal;

afterEach(() => {
  __resetRealtimeForTests();
  getMock.mockReset();
});

describe("realtime client", () => {
  it("доставляет события подписчикам и игнорирует heartbeat и мусор", async () => {
    const s = makeStream();
    getMock.mockResolvedValueOnce(s.response);
    const got: RealtimeEvent[] = [];
    subscribeRealtime("u1", (e) => got.push(e));
    await vi.waitFor(() => expect(isRealtimeConnected()).toBe(true));

    s.push(": connected\n\n");
    s.push(": ping\n\n");
    s.push("data: not-json\n\n");
    s.push('data: {"type":"message.new","conversationId":5}\n\n');

    await vi.waitFor(() => expect(got).toEqual([{ type: "message.new", conversationId: 5 }]));
  });

  it("собирает кадр, пришедший в нескольких чанках", async () => {
    const s = makeStream();
    getMock.mockResolvedValueOnce(s.response);
    const got: RealtimeEvent[] = [];
    subscribeRealtime("u1", (e) => got.push(e));
    await vi.waitFor(() => expect(isRealtimeConnected()).toBe(true));

    s.push('data: {"type":"message.edited",');
    s.push('"conversationId":2}\n\n');

    await vi.waitFor(() => expect(got).toEqual([{ type: "message.edited", conversationId: 2 }]));
  });

  it("переподключается после обрыва и сообщает о смене статуса", async () => {
    const s1 = makeStream();
    const s2 = makeStream();
    getMock.mockResolvedValueOnce(s1.response).mockResolvedValueOnce(s2.response);
    const statuses: boolean[] = [];
    subscribeStatus((v) => statuses.push(v));
    subscribeRealtime("u1", () => {});
    await vi.waitFor(() => expect(isRealtimeConnected()).toBe(true));

    s1.close();

    await vi.waitFor(() => expect(statuses).toEqual([true, false, true]), { timeout: 5000 });
  });

  it("при 401 не повторяет запросы, но стартует заново для нового подписчика", async () => {
    getMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const off1 = subscribeRealtime("u1", () => {});
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));

    const s = makeStream();
    getMock.mockResolvedValueOnce(s.response);
    const off2 = subscribeRealtime("u1", () => {});

    // повтор по таймеру не раньше секунды, значит второй вызов вызван новой подпиской
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2), { timeout: 800 });
    off1();
    off2();
  });

  it("закрывает соединение после ухода последнего подписчика", async () => {
    const s = makeStream();
    getMock.mockResolvedValueOnce(s.response);
    const off = subscribeRealtime("u1", () => {});
    await vi.waitFor(() => expect(isRealtimeConnected()).toBe(true));

    off();

    await vi.waitFor(() => expect(signalOf(0).aborted).toBe(true), { timeout: 4000 });
    expect(isRealtimeConnected()).toBe(false);
  });

  it("не рвёт соединение, если подписчик вернулся в окне ожидания", async () => {
    const s = makeStream();
    getMock.mockResolvedValueOnce(s.response);
    const off1 = subscribeRealtime("u1", () => {});
    await vi.waitFor(() => expect(isRealtimeConnected()).toBe(true));

    off1();
    const off2 = subscribeRealtime("u1", () => {});

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(signalOf(0).aborted).toBe(false);
    off2();
  });

  it("при смене пользователя открывает новое соединение", async () => {
    const s1 = makeStream();
    const s2 = makeStream();
    getMock.mockResolvedValueOnce(s1.response).mockResolvedValueOnce(s2.response);
    const off1 = subscribeRealtime("u1", () => {});
    await vi.waitFor(() => expect(isRealtimeConnected()).toBe(true));

    off1();
    subscribeRealtime("u2", () => {});

    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
    expect(signalOf(0).aborted).toBe(true);
    await vi.waitFor(() => expect(isRealtimeConnected()).toBe(true));
  });
});