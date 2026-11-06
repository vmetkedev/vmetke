import "./env.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";
import { db } from "../db/client.js";
import { posts } from "../db/schema/index.js";
import { resetReportAlertThrottle } from "../services/reports.service.js";

type TestUser = { username: string; id: string; token: string };

let app: FastifyInstance;
let counter = 0;
let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  resetReportAlertThrottle();
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  process.env.TELEGRAM_BOT_TOKEN = "123456:SECRET-TOKEN";
  process.env.TELEGRAM_CHAT_ID = "42";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
});

async function registerUser(): Promise<TestUser> {
  counter++;
  const username = `ra${Date.now().toString(36)}${counter}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: `10.12.${Math.floor(counter / 250)}.${(counter % 250) + 1}`,
    payload: { email: `${username}@example.com`, password: "Password123!", username },
  });
  expect(res.statusCode).toBe(200);
  return { username, id: res.json().user.id, token: res.json().accessToken };
}

const report = (reporter: TestUser, payload: Record<string, unknown>) =>
  app.inject({
    method: "POST",
    url: "/api/reports",
    headers: { authorization: `Bearer ${reporter.token}` },
    payload,
  });

const sentText = (i = 0): string => JSON.parse(fetchMock.mock.calls[i][1].body).text;
const settle = () => new Promise((r) => setTimeout(r, 80));

describe("алерт о новой жалобе", () => {
  it("шлёт тип, причину, участников, комментарий и ссылку, но не содержимое", async () => {
    const author = await registerUser();
    const reporter = await registerUser();
    const [post] = await db
      .insert(posts)
      .values({ authorId: author.id, title: "Заголовок", content: "СЕКРЕТНЫЙ ТЕКСТ ПОСТА" })
      .returning();

    const res = await report(reporter, { targetType: "post", targetId: post.id, reason: "abuse", comment: "грубит" });
    expect(res.statusCode).toBe(201);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const text = sentText();
    expect(text).toContain("Новая жалоба: пост");
    expect(text).toContain("Оскорбления или травля");
    expect(text).toContain(`@${reporter.username}`);
    expect(text).toContain(`@${author.username}`);
    expect(text).toContain("грубит");
    expect(text).toContain(`/admin/reports/${res.json().id}`);
    expect(text).not.toContain("СЕКРЕТНЫЙ ТЕКСТ ПОСТА");
  });

  it("неудачные жалобы (дубль, свой объект, несуществующий) алертов не шлют", async () => {
    const author = await registerUser();
    const reporter = await registerUser();
    expect((await report(reporter, { targetType: "user", targetId: author.id, reason: "spam" })).statusCode).toBe(201);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect((await report(reporter, { targetType: "user", targetId: author.id, reason: "spam" })).statusCode).toBe(409);
    expect((await report(reporter, { targetType: "user", targetId: reporter.id, reason: "spam" })).statusCode).toBe(400);
    expect(
      (await report(reporter, { targetType: "post", targetId: "00000000-0000-4000-8000-000000000000", reason: "spam" }))
        .statusCode,
    ).toBe(404);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("не больше 10 алертов за окно: остальные жалобы создаются без уведомления", async () => {
    const a = await registerUser();
    const b = await registerUser();
    for (let i = 0; i < 10; i++) {
      const target = await registerUser();
      expect((await report(a, { targetType: "user", targetId: target.id, reason: "spam" })).statusCode).toBe(201);
    }
    const target = await registerUser();
    expect((await report(b, { targetType: "user", targetId: target.id, reason: "spam" })).statusCode).toBe(201);

    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("недоступный Telegram не ломает создание жалобы", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const author = await registerUser();
    const reporter = await registerUser();
    expect((await report(reporter, { targetType: "user", targetId: author.id, reason: "spam" })).statusCode).toBe(201);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("без настроек бота ничего не отправляется", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const author = await registerUser();
    const reporter = await registerUser();
    expect((await report(reporter, { targetType: "user", targetId: author.id, reason: "spam" })).statusCode).toBe(201);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});