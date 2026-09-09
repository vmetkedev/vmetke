import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";

async function register(app: FastifyInstance, username: string, password = "Passw0rd!") {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: `${username}@test.com`, password, username },
  });
  return res.json().accessToken as string;
}

async function createPost(app: FastifyInstance, token: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/posts",
    headers: { authorization: `Bearer ${token}` },
    payload: { title: "Заголовок", content: "Текст поста" },
  });
  return res.json().post.id as string;
}

describe("account deletion", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects deletion without authentication", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      payload: { password: "Passw0rd!" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects deletion without a password", async () => {
    const token = await register(app, "deluser1");

    const res = await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects deletion with a wrong password", async () => {
    const token = await register(app, "deluser2");

    const res = await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { password: "WrongPassword1!" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("deletes the account with the correct password and anonymizes the profile", async () => {
    const token = await register(app, "deluser3");

    const del = await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { password: "Passw0rd!" },
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().success).toBe(true);

    const profile = await app.inject({ method: "GET", url: "/api/users/deluser3" });
    expect(profile.statusCode).toBe(404);
  });

  it("prevents login after account deletion", async () => {
    const token = await register(app, "deluser4");

    await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { password: "Passw0rd!" },
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { identifier: "deluser4@test.com", password: "Passw0rd!" },
    });
    expect(login.statusCode).toBe(401);
  });

  it("keeps the user's posts visible under an anonymized profile after deletion", async () => {
    const token = await register(app, "deluser5");
    const postId = await createPost(app, token);

    await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { password: "Passw0rd!" },
    });

    const post = await app.inject({ method: "GET", url: `/api/posts/${postId}` });
    expect(post.statusCode).toBe(200);
    expect(post.json().post.author.username).toMatch(/^deleted_/);
  });

  it("revokes the refresh token on deletion, so it can no longer be used to refresh", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "deluser6@test.com", password: "Passw0rd!", username: "deluser6" },
    });
    const token = registerRes.json().accessToken as string;
    const refreshCookie = registerRes.cookies.find((c) => c.name === "refresh_token");
    expect(refreshCookie).toBeDefined();

    await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { password: "Passw0rd!" },
    });

    const refresh = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: refreshCookie!.value },
    });
    expect(refresh.statusCode).toBe(401);
  });

  it("frees the original email for re-registration after deletion", async () => {
    const token = await register(app, "deluser7");

    await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { password: "Passw0rd!" },
    });

    const reregister = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "deluser7@test.com", password: "NewPassw0rd!", username: "deluser7" },
    });
    expect(reregister.statusCode).toBe(200);
  });
});

describe("account export", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects export without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users/me/export" });
    expect(res.statusCode).toBe(401);
  });

  it("exports the user's profile and content", async () => {
    const token = await register(app, "exportuser1");
    const postId = await createPost(app, token);

    const res = await app.inject({
      method: "GET",
      url: "/api/users/me/export",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.profile.username).toBe("exportuser1");
    expect(body.profile.email).toBe("exportuser1@test.com");
    expect(body.profile).not.toHaveProperty("passwordHash");
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0].id).toBe(postId);
    expect(body.comments).toHaveLength(0);
    expect(body.likes).toHaveLength(0);
    expect(body.bookmarks).toHaveLength(0);
    expect(body.following).toHaveLength(0);
    expect(body.followers).toHaveLength(0);
  });

  it("sets a Content-Disposition header for download", async () => {
    const token = await register(app, "exportuser2");

    const res = await app.inject({
      method: "GET",
      url: "/api/users/me/export",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
  });
});