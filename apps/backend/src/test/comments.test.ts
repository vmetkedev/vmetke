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

describe("comments", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a comment and returns the full author object", async () => {
    const authorToken = await registerAndLogin(app, "postauthor");
    const commenterToken = await registerAndLogin(app, "commenter1");
    const postId = await createPost(app, authorToken);

    const res = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${commenterToken}` },
      payload: { content: "Отличный пост!" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.comment.content).toBe("Отличный пост!");
    expect(body.comment.author).toBeDefined();
    expect(body.comment.author.username).toBe("commenter1");
  });

  it("lists comments for a post without requiring auth", async () => {
    const authorToken = await registerAndLogin(app, "postauthor2");
    const commenterToken = await registerAndLogin(app, "commenter2");
    const postId = await createPost(app, authorToken);

    await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${commenterToken}` },
      payload: { content: "Первый комментарий" },
    });

    const res = await app.inject({ method: "GET", url: `/api/posts/${postId}/comments` });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].content).toBe("Первый комментарий");
    expect(body.comments[0].author.username).toBe("commenter2");
  });

  it("rejects an empty comment", async () => {
    const authorToken = await registerAndLogin(app, "postauthor3");
    const postId = await createPost(app, authorToken);

    const res = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${authorToken}` },
      payload: { content: "" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects a comment over 1000 characters", async () => {
    const authorToken = await registerAndLogin(app, "postauthor4");
    const postId = await createPost(app, authorToken);

    const res = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${authorToken}` },
      payload: { content: "a".repeat(1001) },
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects comment creation without authentication", async () => {
    const authorToken = await registerAndLogin(app, "postauthor5");
    const postId = await createPost(app, authorToken);

    const res = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/comments`,
      payload: { content: "Аноним пытается" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("rejects comment creation with a malformed post id", async () => {
    const authorToken = await registerAndLogin(app, "postauthor6");

    const res = await app.inject({
      method: "POST",
      url: `/api/posts/not-a-uuid/comments`,
      headers: { authorization: `Bearer ${authorToken}` },
      payload: { content: "test" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("allows the comment author to delete their own comment", async () => {
    const authorToken = await registerAndLogin(app, "postauthor7");
    const commenterToken = await registerAndLogin(app, "commenter7");
    const postId = await createPost(app, authorToken);

    const create = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${commenterToken}` },
      payload: { content: "Удалю сам" },
    });
    const commentId = create.json().comment.id;

    const del = await app.inject({
      method: "DELETE",
      url: `/api/posts/comments/${commentId}`,
      headers: { authorization: `Bearer ${commenterToken}` },
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().success).toBe(true);

    const list = await app.inject({ method: "GET", url: `/api/posts/${postId}/comments` });
    expect(list.json().comments).toHaveLength(0);
  });

  it("prevents deleting another user's comment", async () => {
    const authorToken = await registerAndLogin(app, "postauthor8");
    const commenterToken = await registerAndLogin(app, "commenter8");
    const intruderToken = await registerAndLogin(app, "intruder8");
    const postId = await createPost(app, authorToken);

    const create = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${commenterToken}` },
      payload: { content: "Не трогай" },
    });
    const commentId = create.json().comment.id;

    const del = await app.inject({
      method: "DELETE",
      url: `/api/posts/comments/${commentId}`,
      headers: { authorization: `Bearer ${intruderToken}` },
    });
    expect(del.statusCode).toBe(403);

    const list = await app.inject({ method: "GET", url: `/api/posts/${postId}/comments` });
    expect(list.json().comments).toHaveLength(1);
  });

  it("returns 404 when deleting a non-existent comment", async () => {
    const authorToken = await registerAndLogin(app, "postauthor9");

    const res = await app.inject({
      method: "DELETE",
      url: `/api/posts/comments/00000000-0000-0000-0000-000000000000`,
      headers: { authorization: `Bearer ${authorToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for a malformed comment id on delete", async () => {
    const authorToken = await registerAndLogin(app, "postauthor10");

    const res = await app.inject({
      method: "DELETE",
      url: `/api/posts/comments/not-a-uuid`,
      headers: { authorization: `Bearer ${authorToken}` },
    });
    expect(res.statusCode).toBe(400);
  });
});