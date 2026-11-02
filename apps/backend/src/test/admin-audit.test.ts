import "./env.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";
import { db } from "../db/client.js";
import { adminAuditLog } from "../db/schema/index.js";
import { grantRole } from "../services/admin.service.js";

type TestUser = { username: string; id: string; token: string };

let app: FastifyInstance;
let counter = 0;
let admin: TestUser;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});
// Сетап чистит БД между тестами, поэтому админ создаётся перед каждым
beforeEach(async () => {
  admin = await registerUser();
  await grantRole(admin.username, "admin");
});

async function registerUser(prefix = "al"): Promise<TestUser> {
  counter++;
  const username = `${prefix}${Date.now().toString(36)}${counter}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: `10.7.${Math.floor(counter / 250)}.${(counter % 250) + 1}`,
    payload: { email: `${username}@example.com`, password: "Password123!", username },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  return { username, id: body.user.id, token: body.accessToken };
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
const call = (method: Method, url: string, token?: string, payload?: Record<string, unknown>) =>
  app.inject({
    method,
    url: `/api/admin/audit${url}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload,
  });

const unique = (p: string) => `${p}${Date.now().toString(36)}${++counter}`;

async function seed(over: Partial<typeof adminAuditLog.$inferInsert> = {}) {
  const [r] = await db
    .insert(adminAuditLog)
    .values({ adminId: admin.id, action: "test.action", targetType: "user", targetId: "t1", details: {}, ...over })
    .returning();
  return r;
}

const ids = (res: { json(): any }) => res.json().entries.map((e: { id: number }) => e.id);

describe("доступ", () => {
  it("401 без токена", async () => {
    expect((await call("GET", "")).statusCode).toBe(401);
    expect((await call("GET", "/1")).statusCode).toBe(401);
  });

  it("403 для обычного пользователя и модератора", async () => {
    const u = await registerUser();
    expect((await call("GET", "", u.token)).statusCode).toBe(403);
    expect((await call("GET", "/1", u.token)).statusCode).toBe(403);
    await grantRole(u.username, "moderator");
    expect((await call("GET", "", u.token)).statusCode).toBe(403);
    expect((await call("GET", "/1", u.token)).statusCode).toBe(403);
  });

  it("200 для админа", async () => {
    expect((await call("GET", "", admin.token)).statusCode).toBe(200);
  });
});

describe("только чтение", () => {
  it("изменяющих роутов нет: 404 даже для админа", async () => {
    const entry = await seed({ action: unique("ro.") });
    const checks: [Method, string][] = [
      ["POST", ""],
      ["PUT", `/${entry.id}`],
      ["PATCH", `/${entry.id}`],
      ["DELETE", `/${entry.id}`],
    ];
    for (const [method, url] of checks) {
      expect((await call(method, url, admin.token, {})).statusCode).toBe(404);
    }
    const res = await call("GET", `/${entry.id}`, admin.token);
    expect(res.statusCode).toBe(200);
  });
});

describe("список", () => {
  it("новые первыми, админ и подписи, без полного details; CLI без админа", async () => {
    const action = unique("list.");
    await seed({
      action,
      targetType: "post",
      targetId: "p1",
      details: { reason: "спам", snapshot: { authorUsername: "alice", content: "большой текст" } },
    });
    await seed({ action, adminId: null, details: { via: "cli", role: "admin" } });

    const res = await call("GET", `?action=${action}`, admin.token);
    expect(res.statusCode).toBe(200);
    const { entries } = res.json();
    expect(entries).toHaveLength(2);

    const [cli, withAdmin] = entries;
    expect(cli.admin).toBeNull();
    expect(cli.reason).toBeNull();

    expect(withAdmin).toMatchObject({
      action,
      targetType: "post",
      targetId: "p1",
      admin: { id: admin.id, username: admin.username },
      reason: "спам",
      targetLabel: "alice",
    });
    expect(withAdmin).not.toHaveProperty("details");
  });

  it("подпись цели берётся из details.username", async () => {
    const action = unique("label.");
    await seed({ action, details: { username: "bob", reason: "причина" } });
    const [entry] = (await call("GET", `?action=${action}`, admin.token)).json().entries;
    expect(entry.targetLabel).toBe("bob");
  });

  it("фильтры по действию, типу цели и id цели", async () => {
    const action = unique("flt.");
    const a = await seed({ action, targetType: "post", targetId: "p1" });
    const b = await seed({ action, targetType: "comment", targetId: "c1" });
    await seed({ action: `${action}.other`, targetType: "post", targetId: "p1" });

    expect(ids(await call("GET", `?action=${action}`, admin.token)).sort()).toEqual([a.id, b.id].sort());
    expect(ids(await call("GET", `?action=${action}&targetType=comment`, admin.token))).toEqual([b.id]);
    expect(ids(await call("GET", `?action=${action}&targetId=p1`, admin.token))).toEqual([a.id]);
  });

  it("фильтр по админу: точный username без учёта регистра", async () => {
    const other = await registerUser();
    const action = unique("adm.");
    const mine = await seed({ action });
    await seed({ action, adminId: other.id });

    expect(ids(await call("GET", `?action=${action}&admin=${admin.username.toUpperCase()}`, admin.token))).toEqual([
      mine.id,
    ]);
    expect(ids(await call("GET", `?action=${action}&admin=${admin.username.slice(0, 4)}`, admin.token))).toEqual([]);
  });

  it("спецсимволы LIKE в фильтре админа не работают как шаблон", async () => {
    const action = unique("like.");
    await seed({ action });
    expect(ids(await call("GET", `?action=${action}&admin=${encodeURIComponent("%")}`, admin.token))).toEqual([]);
  });

  it("фильтр по датам включает границы по дням (UTC)", async () => {
    const action = unique("date.");
    const e = await seed({ action, createdAt: new Date("2026-01-15T12:00:00.000Z") });
    const q = async (qs: string) => ids(await call("GET", `?action=${action}&${qs}`, admin.token));

    expect(await q("from=2026-01-15&to=2026-01-15")).toEqual([e.id]);
    expect(await q("from=2026-01-14&to=2026-01-16")).toEqual([e.id]);
    expect(await q("to=2026-01-14")).toEqual([]);
    expect(await q("from=2026-01-16")).toEqual([]);
  });

  it("курсорная пагинация без дублей и пропусков", async () => {
    const action = unique("page.");
    const created: number[] = [];
    for (let i = 0; i < 5; i++) created.push((await seed({ action })).id);

    const seen: number[] = [];
    const sizes: number[] = [];
    let cursor: number | null = null;
    for (let guard = 0; guard < 10; guard++) {
      const res = await call("GET", `?action=${action}&limit=2${cursor ? `&cursor=${cursor}` : ""}`, admin.token);
      const body = res.json();
      sizes.push(body.entries.length);
      seen.push(...body.entries.map((e: { id: number }) => e.id));
      cursor = body.nextCursor;
      if (!cursor) break;
    }
    expect(sizes).toEqual([2, 2, 1]);
    expect(new Set(seen).size).toBe(5);
    expect([...seen].sort((a, b) => a - b)).toEqual([...created].sort((a, b) => a - b));
    expect(seen).toEqual([...seen].sort((a, b) => b - a));
  });

  it("действия, сделанные через API, попадают в журнал", async () => {
    const target = await registerUser();
    const ban = await app.inject({
      method: "POST",
      url: `/api/admin/users/${target.id}/ban`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { reason: "спам из теста" },
    });
    expect(ban.statusCode).toBe(200);

    const res = await call("GET", `?action=user.ban&targetId=${target.id}`, admin.token);
    const { entries } = res.json();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      admin: { username: admin.username },
      reason: "спам из теста",
      targetLabel: target.username,
    });
  });

  it("400 на неверные параметры", async () => {
    expect((await call("GET", "?from=not-a-date", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "?to=2026-13-45", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "?cursor=abc", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "?cursor=0", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "?cursor=99999999999", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "?limit=101", admin.token)).statusCode).toBe(400);
  });
});

describe("запись журнала", () => {
  it("отдаёт полный details со снимком", async () => {
    const entry = await seed({
      action: unique("det."),
      targetType: "post",
      targetId: "p9",
      details: { reason: "спам", snapshot: { content: "полный текст снимка", tags: ["а"] } },
    });
    const res = await call("GET", `/${entry.id}`, admin.token);
    expect(res.statusCode).toBe(200);
    expect(res.json().entry).toMatchObject({
      id: entry.id,
      targetType: "post",
      targetId: "p9",
      admin: { username: admin.username },
      details: { reason: "спам", snapshot: { content: "полный текст снимка", tags: ["а"] } },
    });
  });

  it("404 и 400", async () => {
    expect((await call("GET", "/2000000000", admin.token)).statusCode).toBe(404);
    expect((await call("GET", "/abc", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "/0", admin.token)).statusCode).toBe(400);
  });
});