import "./env.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import jwtPlugin from "../plugins/jwt.js";
import adminRoutes from "../routes/admin/index.js";
import { buildTestApp } from "./app.js";
import { grantRole } from "../services/admin.service.js";

type RouteInfo = { method: string; url: string };

const NIL = "00000000-0000-4000-8000-000000000000";
// Разделы, закрытые для модератора целиком
const ADMIN_ONLY = ["/api/admin/users", "/api/admin/audit"];

async function collectAdminRoutes(): Promise<RouteInfo[]> {
  const found = new Map<string, RouteInfo>();
  const probe = Fastify({ logger: false });
  probe.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      if (method === "HEAD" || method === "OPTIONS") continue;
      found.set(`${method} ${route.url}`, { method, url: route.url });
    }
  });
  await probe.register(jwtPlugin);
  await probe.register(adminRoutes, { prefix: "/api/admin" });
  await probe.ready();
  await probe.close();
  return [...found.values()];
}

let app: FastifyInstance;
let routes: RouteInfo[];
let counter = 0;

beforeAll(async () => {
  routes = await collectAdminRoutes();
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function registerUser(role?: "moderator" | "admin") {
  counter++;
  const username = `cv${Date.now().toString(36)}${counter}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: `10.10.${Math.floor(counter / 250)}.${(counter % 250) + 1}`,
    payload: { email: `${username}@example.com`, password: "Password123!", username },
  });
  expect(res.statusCode).toBe(200);
  if (role) await grantRole(username, role);
  return res.json().accessToken as string;
}

// Параметры пути подставляем заглушкой: защита срабатывает до валидации
const hit = (r: RouteInfo, token?: string) =>
  app.inject({
    method: r.method as "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    url: r.url.replace(/:[^/]+/g, NIL),
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: r.method === "GET" ? undefined : {},
  });

const label = (r: RouteInfo) => `${r.method} ${r.url}`;

describe("защита всех админ-роутов", () => {
  it("роуты найдены (тест не пустой)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(18);
    expect(routes.map(label)).toEqual(
      expect.arrayContaining(["GET /api/admin/whoami", "GET /api/admin/stats"]),
    );
  });

  it("без токена каждый роут отвечает 401", async () => {
    const bad: string[] = [];
    for (const r of routes) {
      const res = await hit(r);
      if (res.statusCode !== 401) bad.push(`${label(r)} → ${res.statusCode}`);
    }
    expect(bad).toEqual([]);
  });

  it("обычный пользователь получает 403 на каждом роуте", async () => {
    const token = await registerUser();
    const bad: string[] = [];
    for (const r of routes) {
      const res = await hit(r, token);
      if (res.statusCode !== 403) bad.push(`${label(r)} → ${res.statusCode}`);
    }
    expect(bad).toEqual([]);
  });

  it("модератор: 403 на «Пользователях» и «Журнале», на остальных защита пропускает", async () => {
    const token = await registerUser("moderator");
    const bad: string[] = [];
    for (const r of routes) {
      const res = await hit(r, token);
      const adminOnly = ADMIN_ONLY.some((p) => r.url.startsWith(p));
      const ok = adminOnly ? res.statusCode === 403 : res.statusCode !== 401 && res.statusCode !== 403;
      if (!ok) bad.push(`${label(r)} → ${res.statusCode}`);
    }
    expect(bad).toEqual([]);
  });

  it("админ проходит защиту на каждом роуте", async () => {
    const token = await registerUser("admin");
    const bad: string[] = [];
    for (const r of routes) {
      const res = await hit(r, token);
      if (res.statusCode === 401 || res.statusCode === 403) bad.push(`${label(r)} → ${res.statusCode}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("регистрация плагина", () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
  const REGISTER = /await app\.register\(adminRoutes, \{ prefix: "\/api\/admin" \}\);/;

  it.each([
    ["src/index.ts", "../index.ts"],
    ["src/test/app.ts", "./app.ts"],
  ])("%s регистрирует adminRoutes с тем же префиксом и после rate-limit", (_name, rel) => {
    const src = read(rel);
    expect(src).toMatch(REGISTER);
    const limit = src.indexOf("register(rateLimit");
    expect(limit).toBeGreaterThan(-1);
    expect(limit).toBeLessThan(src.indexOf("register(adminRoutes"));
    // хук админского лимита должен стоять до глобального rate-limit
    const admin = src.indexOf("applyAdminRateLimit(app)");
    expect(admin).toBeGreaterThan(-1);
    expect(admin).toBeLessThan(limit);
  });
});