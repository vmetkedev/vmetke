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

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

async function createPost(app: FastifyInstance, token: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/posts",
    headers: auth(token),
    payload: { title: "Тестовый пост", content: "Текст поста для проверки счётчика просмотров", tags: [] },
  });
  expect(res.statusCode).toBe(201);
  return res.json().post.id as string;
}

async function open(
  app: FastifyInstance,
  postId: string,
  opts: { token?: string; ip?: string; ua?: string } = {}
) {
  const res = await app.inject({
    method: "GET",
    url: `/api/posts/${postId}`,
    headers: { ...(opts.token ? auth(opts.token) : {}), ...(opts.ua ? { "user-agent": opts.ua } : {}) },
    remoteAddress: opts.ip,
  });
  expect(res.statusCode).toBe(200);
  return res.json().post.viewsCount as number;
}

describe("post views", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("один пользователь считается один раз, сколько бы раз ни открыл пост", async () => {
    const author = await registerAndLogin(app, "author");
    const reader = await registerAndLogin(app, "reader");
    const postId = await createPost(app, author);

    expect(await open(app, postId, { token: reader })).toBe(1);
    expect(await open(app, postId, { token: reader })).toBe(1);
    expect(await open(app, postId, { token: reader })).toBe(1);
  });

  it("разные пользователи считаются отдельно", async () => {
    const author = await registerAndLogin(app, "author");
    const r1 = await registerAndLogin(app, "reader1");
    const r2 = await registerAndLogin(app, "reader2");
    const postId = await createPost(app, author);

    expect(await open(app, postId, { token: r1 })).toBe(1);
    expect(await open(app, postId, { token: r2 })).toBe(2);
    expect(await open(app, postId, { token: r1 })).toBe(2);
  });

  it("просмотры автора не считаются", async () => {
    const author = await registerAndLogin(app, "author");
    const postId = await createPost(app, author);

    expect(await open(app, postId, { token: author })).toBe(0);
    expect(await open(app, postId, { token: author })).toBe(0);
  });

  it("гость с тем же IP и User-Agent считается один раз, другой гость отдельно", async () => {
    const author = await registerAndLogin(app, "author");
    const postId = await createPost(app, author);

    expect(await open(app, postId, { ip: "10.0.0.1", ua: "A" })).toBe(1);
    expect(await open(app, postId, { ip: "10.0.0.1", ua: "A" })).toBe(1);
    expect(await open(app, postId, { ip: "10.0.0.2", ua: "A" })).toBe(2);
    expect(await open(app, postId, { ip: "10.0.0.1", ua: "B" })).toBe(3);
  });
});