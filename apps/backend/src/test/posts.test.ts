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

describe("posts", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a post and it appears in the public feed without auth", async () => {
    const token = await registerAndLogin(app, "author1");

    const create = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Заголовок", content: "Текст поста" },
    });
    expect(create.statusCode).toBe(201);

    const feed = await app.inject({ method: "GET", url: "/api/posts/feed" });
    expect(feed.statusCode).toBe(200);
    const body = feed.json();
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0].title).toBe("Заголовок");
    expect(body.posts[0].isLikedByMe).toBe(false);
  });

  it("rejects post creation without a title", async () => {
    const token = await registerAndLogin(app, "author2");

    const res = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "", content: "Текст" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("prevents editing another user's post", async () => {
    const tokenA = await registerAndLogin(app, "owner");
    const tokenB = await registerAndLogin(app, "intruder");

    const create = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { title: "T", content: "C" },
    });
    const postId = create.json().post.id;

    const edit = await app.inject({
      method: "PATCH",
      url: `/api/posts/${postId}`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { title: "Hacked", content: "Hacked" },
    });
    expect(edit.statusCode).toBe(403);
  });

  it("likes a post and reflects isLikedByMe for the liker only", async () => {
    const tokenA = await registerAndLogin(app, "poster");
    const tokenB = await registerAndLogin(app, "liker");

    const create = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { title: "T", content: "C" },
    });
    const postId = create.json().post.id;

    await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/like`,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    const asLiker = await app.inject({
      method: "GET",
      url: `/api/posts/${postId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(asLiker.json().post.isLikedByMe).toBe(true);
    expect(asLiker.json().post.likesCount).toBe(1);

    const asStranger = await app.inject({ method: "GET", url: `/api/posts/${postId}` });
    expect(asStranger.json().post.isLikedByMe).toBe(false);
    expect(asStranger.json().post.likesCount).toBe(1);
  });
});