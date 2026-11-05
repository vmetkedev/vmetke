import "./env.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { grantRole } from "../services/admin.service.js";

// Читается при регистрации плагина, то есть при buildTestApp() ниже
const prevRead = process.env.ADMIN_RATE_LIMIT_READ;
const prevWrite = process.env.ADMIN_RATE_LIMIT_WRITE;
const prevSensitive = process.env.ADMIN_RATE_LIMIT_SENSITIVE;
process.env.ADMIN_RATE_LIMIT_READ = "3";
process.env.ADMIN_RATE_LIMIT_WRITE = "2";
process.env.ADMIN_RATE_LIMIT_SENSITIVE = "2";

const { buildTestApp } = await import("./app.js");

let app: FastifyInstance;
let counter = 0;
let token: string;
let adminId: string;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
  if (prevRead === undefined) delete process.env.ADMIN_RATE_LIMIT_READ;
  else process.env.ADMIN_RATE_LIMIT_READ = prevRead;
  if (prevWrite === undefined) delete process.env.ADMIN_RATE_LIMIT_WRITE;
  else process.env.ADMIN_RATE_LIMIT_WRITE = prevWrite;
  if (prevSensitive === undefined) delete process.env.ADMIN_RATE_LIMIT_SENSITIVE;
  else process.env.ADMIN_RATE_LIMIT_SENSITIVE = prevSensitive;
});

beforeEach(async () => {
  counter++;
  const username = `rl${Date.now().toString(36)}${counter}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: `10.8.${Math.floor(counter / 250)}.${(counter % 250) + 1}`,
    payload: { email: `${username}@example.com`, password: "Password123!", username },
  });
  expect(res.statusCode).toBe(200);
  token = res.json().accessToken;
  adminId = res.json().user.id;
  await grantRole(username, "admin");
});

const whoami = (ip: string) =>
  app.inject({
    method: "GET",
    url: "/api/admin/whoami",
    remoteAddress: ip,
    headers: { authorization: `Bearer ${token}` },
  });

const forceLogout = (ip: string) =>
  app.inject({
    method: "POST",
    url: "/api/admin/users/00000000-0000-4000-8000-000000000000/logout",
    remoteAddress: ip,
    headers: { authorization: `Bearer ${token}` },
    payload: {},
  });

describe("rate-limit на /api/admin/*", () => {
  it("чтение: после лимита 429", async () => {
    const ip = "10.20.0.1";
    for (let i = 0; i < 3; i++) expect((await whoami(ip)).statusCode).toBe(200);
    expect((await whoami(ip)).statusCode).toBe(429);
  });

  it("изменяющие запросы лимитируются строже", async () => {
    const ip = "10.20.0.2";
    // Несуществующий пользователь: 404, но запрос в лимит засчитывается
    expect((await forceLogout(ip)).statusCode).toBe(404);
    expect((await forceLogout(ip)).statusCode).toBe(404);
    expect((await forceLogout(ip)).statusCode).toBe(429);
  });

  it("лимит считается по IP: другой адрес не затронут", async () => {
    const busy = "10.20.0.3";
    for (let i = 0; i < 4; i++) await whoami(busy);
    expect((await whoami(busy)).statusCode).toBe(429);
    expect((await whoami("10.20.0.4")).statusCode).toBe(200);
  });

  it("лимит не распространяется на остальные роуты", async () => {
    const ip = "10.20.0.5";
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        remoteAddress: ip,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    }
    expect(adminId).toBeTruthy();
  });

  it("роуты с подтверждением паролем лимитируются отдельно и строже", async () => {
    const ip = "10.20.0.6";
    const attempt = () =>
      app.inject({
        method: "PATCH",
        url: "/api/admin/users/00000000-0000-4000-8000-000000000000/role",
        remoteAddress: ip,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: "user", password: "wrong" },
      });
    // записи о неверном пароле не нужны для проверки лимита: до пароля дело не дойдёт
    expect((await attempt()).statusCode).not.toBe(429);
    expect((await attempt()).statusCode).not.toBe(429);
    expect((await attempt()).statusCode).toBe(429);
  });
});