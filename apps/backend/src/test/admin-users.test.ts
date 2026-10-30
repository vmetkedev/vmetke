import "./env.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";
import { db } from "../db/client.js";
import { adminAuditLog } from "../db/schema/index.js";
import { grantRole } from "../services/admin.service.js";

let app: FastifyInstance;
let counter = 0;
let admin: TestUser;

type TestUser = { username: string; id: string; token: string; refresh: string };

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

// Админ создаётся перед каждым тестом: сетап чистит БД между тестами
beforeEach(async () => {
  admin = await registerUser();
  await grantRole(admin.username, "admin");
});

async function registerUser(prefix = "au"): Promise<TestUser> {
  counter++;
  const username = `${prefix}${Date.now().toString(36)}${counter}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: `10.3.${Math.floor(counter / 250)}.${(counter % 250) + 1}`,
    payload: { email: `${username}@example.com`, password: "Password123!", username },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  const refresh = res.cookies.find((c) => c.name === "refresh_token")!.value;
  return { username, id: body.user.id, token: body.accessToken, refresh };
}

const call = (
  method: "GET" | "POST" | "PATCH",
  url: string,
  token?: string,
  payload?: Record<string, unknown>,
) =>
  app.inject({
    method,
    url: `/api/admin/users${url}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload,
  });

const refreshWith = (cookie: string) =>
  app.inject({ method: "POST", url: "/api/auth/refresh", cookies: { refresh_token: cookie } });

const auditRows = (targetId: string, action: string) =>
  db
    .select()
    .from(adminAuditLog)
    .where(and(eq(adminAuditLog.targetId, targetId), eq(adminAuditLog.action, action)));

describe("доступ к /api/admin/users", () => {
  it("401 без токена", async () => {
    expect((await call("GET", "")).statusCode).toBe(401);
  });

  it("403 для обычного пользователя и модератора", async () => {
    const u = await registerUser();
    expect((await call("GET", "", u.token)).statusCode).toBe(403);
    await grantRole(u.username, "moderator");
    expect((await call("GET", "", u.token)).statusCode).toBe(403);
  });

  it("403 на изменяющие роуты для модератора", async () => {
    const mod = await registerUser();
    await grantRole(mod.username, "moderator");
    const target = await registerUser();
    expect((await call("POST", `/${target.id}/ban`, mod.token, { reason: "спам" })).statusCode).toBe(403);
    expect((await call("POST", `/${target.id}/unban`, mod.token)).statusCode).toBe(403);
    expect((await call("PATCH", `/${target.id}/role`, mod.token, { role: "moderator" })).statusCode).toBe(403);
    expect((await call("POST", `/${target.id}/logout`, mod.token)).statusCode).toBe(403);
  });

  it("401 на изменяющие роуты без токена", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect((await call("POST", `/${id}/ban`, undefined, { reason: "спам" })).statusCode).toBe(401);
    expect((await call("POST", `/${id}/unban`)).statusCode).toBe(401);
    expect((await call("PATCH", `/${id}/role`, undefined, { role: "user" })).statusCode).toBe(401);
    expect((await call("POST", `/${id}/logout`)).statusCode).toBe(401);
    expect((await call("GET", `/${id}`)).statusCode).toBe(401);
  });
});

describe("список", () => {
  it("отдаёт email, но не passwordHash", async () => {
    const u = await registerUser();
    const res = await call("GET", `?q=${u.username}`, admin.token);
    expect(res.statusCode).toBe(200);
    const [item] = res.json().users;
    expect(item.email).toBe(`${u.username}@example.com`);
    expect(item).not.toHaveProperty("passwordHash");
    expect(item.role).toBe("user");
    expect(item.bannedAt).toBeNull();
  });

  it("ищет по username и по email", async () => {
    const u = await registerUser();
    const byName = (await call("GET", `?q=${u.username}`, admin.token)).json();
    expect(byName.users.map((x: { id: string }) => x.id)).toContain(u.id);
    const byEmail = (await call("GET", `?q=${encodeURIComponent(`${u.username}@example`)}`, admin.token)).json();
    expect(byEmail.users.map((x: { id: string }) => x.id)).toContain(u.id);
  });

  it("спецсимволы LIKE в поиске не работают как шаблон", async () => {
    const res = await call("GET", `?q=${encodeURIComponent("%")}`, admin.token);
    expect(res.statusCode).toBe(200);
    for (const u of res.json().users) {
      expect(`${u.username} ${u.email}`).toContain("%");
    }
  });

  it("фильтр по роли", async () => {
    const u = await registerUser();
    await grantRole(u.username, "moderator");
    const yes = (await call("GET", `?role=moderator&q=${u.username}`, admin.token)).json();
    expect(yes.users).toHaveLength(1);
    expect(yes.users[0].role).toBe("moderator");
    const no = (await call("GET", `?role=user&q=${u.username}`, admin.token)).json();
    expect(no.users).toHaveLength(0);
  });

  it("фильтр banned", async () => {
    const u = await registerUser();
    await call("POST", `/${u.id}/ban`, admin.token, { reason: "тест фильтра" });
    const banned = (await call("GET", `?banned=true&q=${u.username}`, admin.token)).json();
    expect(banned.users).toHaveLength(1);
    expect(banned.users[0].bannedAt).not.toBeNull();
    const notBanned = (await call("GET", `?banned=false&q=${u.username}`, admin.token)).json();
    expect(notBanned.users).toHaveLength(0);
  });

  it("курсорная пагинация без дублей и пропусков", async () => {
    const prefix = `pg${Date.now().toString(36)}`;
    const created = [await registerUser(prefix), await registerUser(prefix), await registerUser(prefix)];

    const page1 = (await call("GET", `?q=${prefix}&limit=2`, admin.token)).json();
    expect(page1.users).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = (await call("GET", `?q=${prefix}&limit=2&cursor=${page1.nextCursor}`, admin.token)).json();
    expect(page2.users).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();

    const ids = [...page1.users, ...page2.users].map((x: { id: string }) => x.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.sort()).toEqual(created.map((c) => c.id).sort());
  });

  it("400 на неверный cursor и слишком большой limit", async () => {
    expect((await call("GET", "?cursor=nope", admin.token)).statusCode).toBe(400);
    expect((await call("GET", "?limit=101", admin.token)).statusCode).toBe(400);
  });
});

describe("карточка", () => {
  it("профиль, счётчики и последняя активность", async () => {
    const u = await registerUser();
    const res = await call("GET", `/${u.id}`, admin.token);
    expect(res.statusCode).toBe(200);
    const { user } = res.json();
    expect(user.username).toBe(u.username);
    expect(user.postsCount).toBe(0);
    expect(user.commentsCount).toBe(0);
    expect(user.lastActiveAt).toBeTruthy();
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("404 для несуществующего и 400 для некорректного id", async () => {
    expect((await call("GET", "/00000000-0000-4000-8000-000000000000", admin.token)).statusCode).toBe(404);
    expect((await call("GET", "/not-a-uuid", admin.token)).statusCode).toBe(400);
  });
});

describe("бан и разбан", () => {
  it("бан: вход закрыт, refresh-токены отозваны, запись в журнале", async () => {
    const target = await registerUser();
    const bystander = await registerUser();

    const res = await call("POST", `/${target.id}/ban`, admin.token, { reason: "спам" });
    expect(res.statusCode).toBe(200);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: "10.9.0.1",
      payload: { identifier: target.username, password: "Password123!" },
    });
    expect(login.statusCode).toBe(403);

    expect((await refreshWith(target.refresh)).statusCode).toBe(401);
    // контроль: чужой токен продолжает работать
    expect((await refreshWith(bystander.refresh)).statusCode).toBe(200);

    const rows = await auditRows(target.id, "user.ban");
    expect(rows).toHaveLength(1);
    expect(rows[0].adminId).toBe(admin.id);
    expect(rows[0].details).toMatchObject({ reason: "спам", username: target.username });

    const detail = (await call("GET", `/${target.id}`, admin.token)).json().user;
    expect(detail.bannedAt).not.toBeNull();
    expect(detail.banReason).toBe("спам");
  });

  it("забаненный модератор сразу теряет доступ к админке", async () => {
    const mod = await registerUser();
    await grantRole(mod.username, "moderator");
    const who = () =>
      app.inject({ method: "GET", url: "/api/admin/whoami", headers: { authorization: `Bearer ${mod.token}` } });
    expect((await who()).statusCode).toBe(200);
    await call("POST", `/${mod.id}/ban`, admin.token, { reason: "проверка мгновенности" });
    expect((await who()).statusCode).toBe(401);
  });

  it("причина обязательна", async () => {
    const target = await registerUser();
    expect((await call("POST", `/${target.id}/ban`, admin.token, {})).statusCode).toBe(400);
    expect((await call("POST", `/${target.id}/ban`, admin.token, { reason: "  " })).statusCode).toBe(400);
    expect((await call("POST", `/${target.id}/ban`, admin.token, { reason: "x".repeat(501) })).statusCode).toBe(400);
  });

  it("нельзя забанить себя", async () => {
    const res = await call("POST", `/${admin.id}/ban`, admin.token, { reason: "сам себя" });
    expect(res.statusCode).toBe(400);
  });

  it("повторный бан даёт 409, неизвестный пользователь 404", async () => {
    const target = await registerUser();
    await call("POST", `/${target.id}/ban`, admin.token, { reason: "первый" });
    expect((await call("POST", `/${target.id}/ban`, admin.token, { reason: "второй" })).statusCode).toBe(409);
    expect(
      (await call("POST", "/00000000-0000-4000-8000-000000000000/ban", admin.token, { reason: "нет такого" })).statusCode,
    ).toBe(404);
  });

  it("разбан возвращает вход и пишет в журнал", async () => {
    const target = await registerUser();
    await call("POST", `/${target.id}/ban`, admin.token, { reason: "временно" });
    expect((await call("POST", `/${target.id}/unban`, admin.token)).statusCode).toBe(200);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: "10.9.0.2",
      payload: { identifier: target.username, password: "Password123!" },
    });
    expect(login.statusCode).toBe(200);

    expect(await auditRows(target.id, "user.unban")).toHaveLength(1);
    const detail = (await call("GET", `/${target.id}`, admin.token)).json().user;
    expect(detail.bannedAt).toBeNull();
    expect(detail.banReason).toBeNull();
  });

  it("разбан не заблокированного даёт 409", async () => {
    const target = await registerUser();
    expect((await call("POST", `/${target.id}/unban`, admin.token)).statusCode).toBe(409);
  });

	it("access-токен забаненного перестаёт работать на обычных эндпоинтах", async () => {
  const target = await registerUser();
  const me = () =>
    app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${target.token}` } });
  expect((await me()).statusCode).toBe(200);
  await call("POST", `/${target.id}/ban`, admin.token, { reason: "проверка authenticate" });
  expect((await me()).statusCode).toBe(401);
});
});

describe("смена роли", () => {
  it("админ повышает до модератора, действует сразу, пишется в журнал", async () => {
    const target = await registerUser();
    const res = await call("PATCH", `/${target.id}/role`, admin.token, { role: "moderator" });
    expect(res.statusCode).toBe(200);

    const who = await app.inject({
      method: "GET",
      url: "/api/admin/whoami",
      headers: { authorization: `Bearer ${target.token}` },
    });
    expect(who.statusCode).toBe(200);
    expect(who.json().role).toBe("moderator");

    const rows = await auditRows(target.id, "role.change");
    expect(rows).toHaveLength(1);
    expect(rows[0].details).toMatchObject({ previousRole: "user", role: "moderator" });
  });

  it("нельзя менять свою роль", async () => {
    const res = await call("PATCH", `/${admin.id}/role`, admin.token, { role: "user" });
    expect(res.statusCode).toBe(400);
  });

  it("400 на недопустимую роль, 409 если роль не меняется", async () => {
    const target = await registerUser();
    expect((await call("PATCH", `/${target.id}/role`, admin.token, { role: "superuser" })).statusCode).toBe(400);
    expect((await call("PATCH", `/${target.id}/role`, admin.token, { role: "user" })).statusCode).toBe(409);
  });

  it("404 для несуществующего пользователя", async () => {
    const res = await call("PATCH", "/00000000-0000-4000-8000-000000000000/role", admin.token, { role: "user" });
    expect(res.statusCode).toBe(404);
  });
});

describe("принудительный выход", () => {
  it("отзывает refresh-токены и пишет в журнал", async () => {
    const target = await registerUser();
    const bystander = await registerUser();

    expect((await call("POST", `/${target.id}/logout`, admin.token)).statusCode).toBe(200);
    expect((await refreshWith(target.refresh)).statusCode).toBe(401);
    expect((await refreshWith(bystander.refresh)).statusCode).toBe(200);
    expect(await auditRows(target.id, "user.force_logout")).toHaveLength(1);
  });

  it("404 для несуществующего пользователя", async () => {
    expect((await call("POST", "/00000000-0000-4000-8000-000000000000/logout", admin.token)).statusCode).toBe(404);
  });
});