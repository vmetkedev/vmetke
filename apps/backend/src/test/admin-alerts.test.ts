import "./env.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";
import { grantRole, grantRoleViaCli } from "../services/admin.service.js";

type TestUser = { username: string; id: string; token: string };

const PASSWORD = "Password123!";
let app: FastifyInstance;
let counter = 0;
let admin: TestUser;
let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Админ создаётся до включения бота: регистрация алертов не шлёт, но так надёжнее
  admin = await registerUser();
  await grantRole(admin.username, "admin");

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
  const username = `tg${Date.now().toString(36)}${counter}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: `10.11.${Math.floor(counter / 250)}.${(counter % 250) + 1}`,
    payload: { email: `${username}@example.com`, password: PASSWORD, username },
  });
  expect(res.statusCode).toBe(200);
  return { username, id: res.json().user.id, token: res.json().accessToken };
}

const call = (method: "POST" | "PATCH", url: string, payload: Record<string, unknown>) =>
  app.inject({
    method,
    url: `/api/admin/users${url}`,
    headers: { authorization: `Bearer ${admin.token}` },
    payload,
  });

const sentText = (i = 0): string => JSON.parse(fetchMock.mock.calls[i][1].body).text;
const settle = () => new Promise((r) => setTimeout(r, 80));

describe("алерты в Telegram", () => {
  it("бан: сообщение с целью, админом и причиной", async () => {
    const target = await registerUser();
    expect((await call("POST", `/${target.id}/ban`, { reason: "массовый спам" })).statusCode).toBe(200);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const text = sentText();
    expect(text).toContain("Блокировка");
    expect(text).toContain(`@${target.username}`);
    expect(text).toContain(`@${admin.username}`);
    expect(text).toContain("массовый спам");
  });

  it("смена роли: прежняя и новая роль", async () => {
    const target = await registerUser();
    const res = await call("PATCH", `/${target.id}/role`, { role: "moderator", password: PASSWORD });
    expect(res.statusCode).toBe(200);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const text = sentText();
    expect(text).toContain("Смена роли");
    expect(text).toContain(`@${target.username}`);
    expect(text).toContain("user → moderator");
    expect(text).toContain(`@${admin.username}`);
  });

  it("выдача роли из CLI", async () => {
    const target = await registerUser();
    const result = await grantRoleViaCli(target.username, "admin");
    expect(result).toMatchObject({ previousRole: "user", role: "admin" });

    // CLI ждёт отправки сам
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentText()).toContain(`@${target.username}`);
    expect(sentText()).toContain("user → admin");
  });

  it("CLI для несуществующего пользователя ничего не шлёт", async () => {
    expect(await grantRoleViaCli("no_such_user_xyz", "admin")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("неудачные действия алертов не шлют", async () => {
    const target = await registerUser();
    // неверный пароль
    expect((await call("PATCH", `/${target.id}/role`, { role: "moderator", password: "wrong" })).statusCode).toBe(403);
    // бан без причины
    expect((await call("POST", `/${target.id}/ban`, {})).statusCode).toBe(400);
    // повторный бан
    expect((await call("POST", `/${target.id}/ban`, { reason: "первый" })).statusCode).toBe(200);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect((await call("POST", `/${target.id}/ban`, { reason: "второй" })).statusCode).toBe(409);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("разбан алерта не шлёт", async () => {
    const target = await registerUser();
    await call("POST", `/${target.id}/ban`, { reason: "временно" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect((await call("POST", `/${target.id}/unban`, {})).statusCode).toBe(200);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("недоступный Telegram не ломает действие", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const target = await registerUser();
    expect((await call("POST", `/${target.id}/ban`, { reason: "спам" })).statusCode).toBe(200);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("без настроек бота действия работают, ничего не отправляется", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const target = await registerUser();
    expect((await call("POST", `/${target.id}/ban`, { reason: "спам" })).statusCode).toBe(200);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});