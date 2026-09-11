import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";

async function registerAndLogin(app: FastifyInstance, username: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: `${username}@test.com`, password: "Passw0rd!", username },
  });
  return res.json().accessToken as string;
}

async function getProfile(app: FastifyInstance, username: string) {
  const res = await app.inject({ method: "GET", url: `/api/users/${username}` });
  return res.json().user;
}

describe("avatar color", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("has no avatar color by default", async () => {
    await registerAndLogin(app, "avataruser1");
    const profile = await getProfile(app, "avataruser1");
    expect(profile.avatarColor).toBeNull();
  });

  it("rejects updating avatar color without authentication", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me/avatar",
      payload: { avatarColor: 3 },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a missing avatarColor", async () => {
    const token = await registerAndLogin(app, "avataruser2");

    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a negative avatarColor", async () => {
    const token = await registerAndLogin(app, "avataruser3");

    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarColor: -1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an avatarColor above the palette range", async () => {
    const token = await registerAndLogin(app, "avataruser4");

    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarColor: 10 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a non-integer avatarColor", async () => {
    const token = await registerAndLogin(app, "avataruser5");

    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarColor: 2.5 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("updates the avatar color and reflects it on the profile", async () => {
    const token = await registerAndLogin(app, "avataruser6");

    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarColor: 5 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    const profile = await getProfile(app, "avataruser6");
    expect(profile.avatarColor).toBe(5);
  });

  it("allows changing the avatar color again", async () => {
    const token = await registerAndLogin(app, "avataruser7");

    await app.inject({
      method: "PATCH",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarColor: 1 },
    });
    await app.inject({
      method: "PATCH",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarColor: 9 },
    });

    const profile = await getProfile(app, "avataruser7");
    expect(profile.avatarColor).toBe(9);
  });

  it("accepts the boundary values 0 and 9", async () => {
    const token = await registerAndLogin(app, "avataruser8");

    const zero = await app.inject({
      method: "PATCH",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarColor: 0 },
    });
    expect(zero.statusCode).toBe(200);

    const nine = await app.inject({
      method: "PATCH",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarColor: 9 },
    });
    expect(nine.statusCode).toBe(200);
  });
});