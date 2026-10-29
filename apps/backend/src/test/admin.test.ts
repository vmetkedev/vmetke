import "./env.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";
import { db } from "../db/client.js";
import { adminAuditLog } from "../db/schema/index.js";
import { grantRole } from "../services/admin.service.js";

let app: FastifyInstance;
let counter = 0;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function registerUser() {
  counter++;
  const username = `adm${Date.now().toString(36)}${counter}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: `10.1.0.${counter}`,
    payload: { email: `${username}@example.com`, password: "Password123!", username },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  return { username, id: body.user.id as string, token: body.accessToken as string };
}

const whoami = (token?: string) =>
  app.inject({
    method: "GET",
    url: "/api/admin/whoami",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

describe("admin access (7.1)", () => {
  it("401 без токена", async () => {
    expect((await whoami()).statusCode).toBe(401);
  });

  it("403 для обычного пользователя", async () => {
    const u = await registerUser();
    expect((await whoami(u.token)).statusCode).toBe(403);
  });

  it("200 для модератора", async () => {
    const u = await registerUser();
    await grantRole(u.username, "moderator");
    const res = await whoami(u.token);
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("moderator");
  });

  it("200 для админа", async () => {
    const u = await registerUser();
    await grantRole(u.username, "admin");
    const res = await whoami(u.token);
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("admin");
  });

  it("понижение действует сразу, тем же токеном", async () => {
    const u = await registerUser();
    await grantRole(u.username, "admin");
    expect((await whoami(u.token)).statusCode).toBe(200);
    await grantRole(u.username, "user");
    expect((await whoami(u.token)).statusCode).toBe(403);
  });

  it("/auth/me возвращает роль", async () => {
    const u = await registerUser();
    await grantRole(u.username, "moderator");
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${u.token}` },
    });
    expect(res.json().user.role).toBe("moderator");
  });
});

describe("grantRole", () => {
  it("пишет строку в admin_audit_log", async () => {
    const u = await registerUser();
    await grantRole(u.username, "admin");
    const rows = await db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, u.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("role.grant");
    expect(rows[0].adminId).toBeNull();
    expect(rows[0].details).toMatchObject({ previousRole: "user", role: "admin", via: "cli" });
  });

  it("возвращает null для несуществующего username", async () => {
    expect(await grantRole("no_such_user_xyz", "admin")).toBeNull();
  });
});