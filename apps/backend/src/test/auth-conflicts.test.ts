import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";

describe("registration conflicts", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 409 when the email is already taken", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "taken@test.com", password: "Passw0rd!", username: "firstuser" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "taken@test.com", password: "Passw0rd!", username: "seconduser" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/email/i);
  });

  it("returns 409 when the username is already taken", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "userone@test.com", password: "Passw0rd!", username: "takenname" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "usertwo@test.com", password: "Passw0rd!", username: "takenname" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/username/i);
  });

  it("allows registration with a different email and username", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "unique@test.com", password: "Passw0rd!", username: "uniquename" },
    });
    expect(res.statusCode).toBe(200);
  });
});