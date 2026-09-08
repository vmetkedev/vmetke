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

async function createPost(app: FastifyInstance, token: string, title: string, content: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/posts",
    headers: { authorization: `Bearer ${token}` },
    payload: { title, content },
  });
  return res.json().post.id as string;
}

async function search(app: FastifyInstance, token: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return app.inject({
    method: "GET",
    url: `/api/search?${query}`,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("search", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects unauthenticated search", async () => {
    const res = await app.inject({ method: "GET", url: "/api/search?q=test&type=posts" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a request without q", async () => {
    const token = await registerAndLogin(app, "searcher1");
    const res = await search(app, token, { type: "posts" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a request without type", async () => {
    const token = await registerAndLogin(app, "searcher2");
    const res = await search(app, token, { q: "test" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an invalid type", async () => {
    const token = await registerAndLogin(app, "searcher3");
    const res = await search(app, token, { q: "test", type: "comments" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an empty q", async () => {
    const token = await registerAndLogin(app, "searcher4");
    const res = await search(app, token, { q: "", type: "posts" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects q over 100 characters", async () => {
    const token = await registerAndLogin(app, "searcher5");
    const res = await search(app, token, { q: "a".repeat(101), type: "posts" });
    expect(res.statusCode).toBe(400);
  });

  it("finds posts by title, case-insensitively", async () => {
    const token = await registerAndLogin(app, "searcher6");
    await createPost(app, token, "Уникальный Заголовок Пост", "содержимое");
    await createPost(app, token, "Другой пост", "не совпадает");

    const res = await search(app, token, { q: "уникальный", type: "posts" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.type).toBe("posts");
    expect(body.results).toHaveLength(1);
    expect(body.results[0].title).toBe("Уникальный Заголовок Пост");
    expect(body.results[0].author.username).toBe("searcher6");
  });

  it("finds posts by content", async () => {
    const token = await registerAndLogin(app, "searcher7");
    await createPost(app, token, "Заголовок", "особоеслововпоиске текст поста");

    const res = await search(app, token, { q: "особоеслововпоиске", type: "posts" });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toHaveLength(1);
  });

  it("returns no post results when nothing matches", async () => {
    const token = await registerAndLogin(app, "searcher8");
    await createPost(app, token, "Заголовок", "содержимое");

    const res = await search(app, token, { q: "несуществующаястрока12345", type: "posts" });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toHaveLength(0);
  });

  it("finds users by username, case-insensitively", async () => {
    const token = await registerAndLogin(app, "searcher9");
    await registerAndLogin(app, "uniquenamefinder");

    const res = await search(app, token, { q: "UNIQUENAME", type: "users" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.type).toBe("users");
    expect(body.results).toHaveLength(1);
    expect(body.results[0].username).toBe("uniquenamefinder");
  });

  it("does not return posts when type is users", async () => {
    const token = await registerAndLogin(app, "searcher10");
    await createPost(app, token, "поискслово", "содержимое");

    const res = await search(app, token, { q: "поискслово", type: "users" });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toHaveLength(0);
  });

  it("respects the limit parameter", async () => {
    const token = await registerAndLogin(app, "searcher11");
    for (let i = 0; i < 5; i++) {
      await createPost(app, token, `Повторяющийся заголовок ${i}`, "текст");
    }

    const res = await search(app, token, { q: "Повторяющийся", type: "posts", limit: "2" });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toHaveLength(2);
  });

  it("rejects a limit over 30", async () => {
    const token = await registerAndLogin(app, "searcher12");
    const res = await search(app, token, { q: "test", type: "posts", limit: "31" });
    expect(res.statusCode).toBe(400);
  });
});