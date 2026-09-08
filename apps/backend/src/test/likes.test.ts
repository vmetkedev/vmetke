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

async function createPost(app: FastifyInstance, token: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/posts",
    headers: { authorization: `Bearer ${token}` },
    payload: { title: "Заголовок", content: "Текст поста" },
  });
  return res.json().post.id as string;
}

async function getPost(app: FastifyInstance, postId: string, token?: string) {
  const res = await app.inject({
    method: "GET",
    url: `/api/posts/${postId}`,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
  return res.json().post;
}

describe("likes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("likes a post and updates likesCount and isLikedByMe", async () => {
    const authorToken = await registerAndLogin(app, "likeauthor1");
    const likerToken = await registerAndLogin(app, "liker1");
    const postId = await createPost(app, authorToken);

    const res = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/like`,
      headers: { authorization: `Bearer ${likerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    const post = await getPost(app, postId, likerToken);
    expect(post.likesCount).toBe(1);
    expect(post.isLikedByMe).toBe(true);
  });

  it("is idempotent when liking the same post twice", async () => {
    const authorToken = await registerAndLogin(app, "likeauthor2");
    const likerToken = await registerAndLogin(app, "liker2");
    const postId = await createPost(app, authorToken);

    await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/like`,
      headers: { authorization: `Bearer ${likerToken}` },
    });
    const second = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/like`,
      headers: { authorization: `Bearer ${likerToken}` },
    });
    expect(second.statusCode).toBe(200);

    const post = await getPost(app, postId, likerToken);
    expect(post.likesCount).toBe(1);
  });

  it("unlikes a post and decreases likesCount", async () => {
    const authorToken = await registerAndLogin(app, "likeauthor3");
    const likerToken = await registerAndLogin(app, "liker3");
    const postId = await createPost(app, authorToken);

    await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/like`,
      headers: { authorization: `Bearer ${likerToken}` },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/posts/${postId}/like`,
      headers: { authorization: `Bearer ${likerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    const post = await getPost(app, postId, likerToken);
    expect(post.likesCount).toBe(0);
    expect(post.isLikedByMe).toBe(false);
  });

  it("unliking a post that was never liked is a no-op", async () => {
    const authorToken = await registerAndLogin(app, "likeauthor4");
    const strangerToken = await registerAndLogin(app, "stranger4");
    const postId = await createPost(app, authorToken);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/posts/${postId}/like`,
      headers: { authorization: `Bearer ${strangerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    const post = await getPost(app, postId);
    expect(post.likesCount).toBe(0);
  });

  it("counts likes from multiple users independently", async () => {
    const authorToken = await registerAndLogin(app, "likeauthor5");
    const likerA = await registerAndLogin(app, "likerA5");
    const likerB = await registerAndLogin(app, "likerB5");
    const postId = await createPost(app, authorToken);

    await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/like`,
      headers: { authorization: `Bearer ${likerA}` },
    });
    await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/like`,
      headers: { authorization: `Bearer ${likerB}` },
    });

    const postAsA = await getPost(app, postId, likerA);
    expect(postAsA.likesCount).toBe(2);
    expect(postAsA.isLikedByMe).toBe(true);

    const postAsStranger = await getPost(app, postId);
    expect(postAsStranger.likesCount).toBe(2);
    expect(postAsStranger.isLikedByMe).toBe(false);
  });

  it("allows a user to like their own post", async () => {
    const authorToken = await registerAndLogin(app, "likeauthor6");
    const postId = await createPost(app, authorToken);

    const res = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/like`,
      headers: { authorization: `Bearer ${authorToken}` },
    });
    expect(res.statusCode).toBe(200);

    const post = await getPost(app, postId, authorToken);
    expect(post.likesCount).toBe(1);
    expect(post.isLikedByMe).toBe(true);
  });

  it("rejects liking without authentication", async () => {
    const authorToken = await registerAndLogin(app, "likeauthor7");
    const postId = await createPost(app, authorToken);

    const res = await app.inject({ method: "POST", url: `/api/posts/${postId}/like` });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when liking a non-existent post", async () => {
    const token = await registerAndLogin(app, "likeauthor10");

    const res = await app.inject({
      method: "POST",
      url: `/api/posts/00000000-0000-0000-0000-000000000000/like`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects liking with a malformed post id", async () => {
    const token = await registerAndLogin(app, "likeauthor8");

    const res = await app.inject({
      method: "POST",
      url: `/api/posts/not-a-uuid/like`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects unliking with a malformed post id", async () => {
    const token = await registerAndLogin(app, "likeauthor9");

    const res = await app.inject({
      method: "DELETE",
      url: `/api/posts/not-a-uuid/like`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });
});