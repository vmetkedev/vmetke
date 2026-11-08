import "./env.js";
import { EventEmitter } from "node:events";
import type { ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  addClient,
  closeAllClients,
  disconnectUser,
  MAX_CONNECTIONS_PER_USER,
  publish,
} from "../services/realtime.service.js";
import { buildTestApp } from "./app.js";

class FakeRes extends EventEmitter {
  chunks: string[] = [];
  writableEnded = false;
  destroyed = false;
  failWrites = false;
  write(chunk: string) {
    if (this.failWrites) throw new Error("socket closed");
    this.chunks.push(chunk);
    return true;
  }
  end() {
    this.writableEnded = true;
    this.emit("close");
  }
}

const fake = () => new FakeRes();
const asRes = (f: FakeRes) => f as unknown as ServerResponse;
const frames = (f: FakeRes) => f.chunks.filter((c) => c.startsWith("data: "));

afterEach(() => closeAllClients());

describe("realtime hub", () => {
  it("доставляет событие только указанным пользователям", () => {
    const a = fake();
    const b = fake();
    addClient("user-a", asRes(a));
    addClient("user-b", asRes(b));

    publish(["user-a"], { type: "message.new", conversationId: 7 });

    expect(frames(a)).toEqual(['data: {"type":"message.new","conversationId":7}\n\n']);
    expect(frames(b)).toHaveLength(0);
  });

  it("не дублирует событие, если пользователь указан дважды", () => {
    const a = fake();
    addClient("user-a", asRes(a));
    publish(["user-a", "user-a"], { type: "block.changed" });
    expect(frames(a)).toHaveLength(1);
  });

  it("доставляет событие во все вкладки пользователя", () => {
    const a1 = fake();
    const a2 = fake();
    addClient("user-a", asRes(a1));
    addClient("user-a", asRes(a2));
    publish(["user-a"], { type: "conversation.read", conversationId: 1 });
    expect(frames(a1)).toHaveLength(1);
    expect(frames(a2)).toHaveLength(1);
  });

  it("после отписки события не приходят", () => {
    const a = fake();
    const remove = addClient("user-a", asRes(a));
    remove();
    publish(["user-a"], { type: "message.new", conversationId: 1 });
    expect(frames(a)).toHaveLength(0);
  });

  it("сверх лимита закрывает самое старое соединение", () => {
    const all = Array.from({ length: MAX_CONNECTIONS_PER_USER + 1 }, () => fake());
    all.forEach((f) => addClient("user-a", asRes(f)));

    expect(all[0].writableEnded).toBe(true);
    expect(all[1].writableEnded).toBe(false);

    publish(["user-a"], { type: "message.new", conversationId: 1 });
    expect(frames(all[0])).toHaveLength(0);
    expect(frames(all[MAX_CONNECTIONS_PER_USER])).toHaveLength(1);
  });

  it("disconnectUser закрывает все соединения пользователя и не трогает чужие", () => {
    const a = fake();
    const b = fake();
    addClient("user-a", asRes(a));
    addClient("user-b", asRes(b));

    disconnectUser("user-a");

    expect(a.writableEnded).toBe(true);
    expect(b.writableEnded).toBe(false);
  });

  it("мёртвое соединение не ломает рассылку остальным", () => {
    const dead = fake();
    const alive = fake();
    addClient("user-a", asRes(dead));
    addClient("user-a", asRes(alive));
    dead.failWrites = true;

    publish(["user-a"], { type: "message.new", conversationId: 1 });
    expect(frames(alive)).toHaveLength(1);

    publish(["user-a"], { type: "message.new", conversationId: 2 });
    expect(frames(alive)).toHaveLength(2);
  });
});

describe("GET /api/events", () => {
  it("без токена возвращает 401", async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: "GET", url: "/api/events" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});