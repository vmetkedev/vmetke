import "./env.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";
import { grantRole } from "../services/admin.service.js";
import { resetStatsCache } from "../services/admin-stats.service.js";

let app: FastifyInstance;
let counter = 0;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => resetStatsCache());

async function registerUser() {
  counter++;
  const username = `st${Date.now().toString(36)}${counter}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: `10.2.0.${counter}`,
    payload: { email: `${username}@example.com`, password: "Password123!", username },
  });
  expect(res.statusCode).toBe(200);
  return { username, token: res.json().accessToken as string };
}

const getStats = (token?: string) =>
  app.inject({
    method: "GET",
    url: "/api/admin/stats",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

describe("GET /api/admin/stats", () => {
  it("401 без токена", async () => {
    expect((await getStats()).statusCode).toBe(401);
  });

  it("403 для обычного пользователя", async () => {
    const u = await registerUser();
    expect((await getStats(u.token)).statusCode).toBe(403);
  });

  it("200 для модератора, только числа без содержимого", async () => {
    const u = await registerUser();
    await grantRole(u.username, "moderator");
    const res = await getStats(u.token);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Object.keys(body).sort()).toEqual(
      ["comments", "conversations", "generatedAt", "messages", "posts", "users"].sort(),
    );
    expect(Object.keys(body.users).sort()).toEqual(["last24h", "last7d", "total"]);
    for (const v of [body.users.total, body.users.last24h, body.users.last7d, body.posts, body.comments, body.conversations, body.messages]) {
      expect(typeof v).toBe("number");
    }
  });

  it("200 для админа", async () => {
    const u = await registerUser();
    await grantRole(u.username, "admin");
    expect((await getStats(u.token)).statusCode).toBe(200);
  });

  it("новый пользователь попадает в total, last24h и last7d после сброса кэша", async () => {
    const admin = await registerUser();
    await grantRole(admin.username, "admin");
    const before = (await getStats(admin.token)).json();

    await registerUser();
    resetStatsCache();
    const after = (await getStats(admin.token)).json();

    expect(after.users.total).toBeGreaterThanOrEqual(before.users.total + 1);
    expect(after.users.last24h).toBeGreaterThanOrEqual(before.users.last24h + 1);
    expect(after.users.last7d).toBeGreaterThanOrEqual(before.users.last7d + 1);
  });

  it("в пределах 60 секунд отдаёт закэшированный ответ", async () => {
    const admin = await registerUser();
    await grantRole(admin.username, "admin");
    const first = (await getStats(admin.token)).json();

    await registerUser(); // без сброса кэша
    const second = (await getStats(admin.token)).json();

    expect(second).toEqual(first);
  });
});