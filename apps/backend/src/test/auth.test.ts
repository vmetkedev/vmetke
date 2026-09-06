import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";

describe("auth", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("registers a new user and returns an access token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "a@test.com", password: "Passw0rd!", username: "usera" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTypeOf("string");
    expect(body.user.username).toBe("usera");
  });

  it("rejects a password without a special character", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "b@test.com", password: "password1", username: "userb" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("logs in with email or username", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "c@test.com", password: "Passw0rd!", username: "userc" },
    });

    const byEmail = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { identifier: "c@test.com", password: "Passw0rd!" },
    });
    expect(byEmail.statusCode).toBe(200);

    const byUsername = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { identifier: "userc", password: "Passw0rd!" },
    });
    expect(byUsername.statusCode).toBe(200);
  });

  it("rotates the refresh token and invalidates the old one", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "d@test.com", password: "Passw0rd!", username: "userd" },
    });
    const cookieHeader = register.cookies.find((c) => c.name === "refresh_token");
    expect(cookieHeader).toBeDefined();

    const firstRefresh = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: cookieHeader!.value },
    });
    expect(firstRefresh.statusCode).toBe(200);

    const secondRefreshWithOldToken = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: cookieHeader!.value },
    });
    expect(secondRefreshWithOldToken.statusCode).toBe(401);
  });
});