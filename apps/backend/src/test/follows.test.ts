import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app.js";

async function registerAndLogin(app: FastifyInstance, username: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: `${username}@test.com`, password: "Passw0rd!", username },
  });
  const body = res.json();
  return { token: body.accessToken as string, userId: body.user.id as string };
}

describe("follows", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("prevents following yourself", async () => {
    const { token, userId } = await registerAndLogin(app, "solo");

    const res = await app.inject({
      method: "POST",
      url: `/api/follows/${userId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it("follow/unfollow updates follower counts", async () => {
    const a = await registerAndLogin(app, "followerx");
    const b = await registerAndLogin(app, "followedx");

    await app.inject({
      method: "POST",
      url: `/api/follows/${b.userId}`,
      headers: { authorization: `Bearer ${a.token}` },
    });

    const profileAfterFollow = await app.inject({
      method: "GET",
      url: "/api/users/followedx",
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(profileAfterFollow.json().user.followersCount).toBe(1);
    expect(profileAfterFollow.json().user.isFollowedByMe).toBe(true);

    await app.inject({
      method: "DELETE",
      url: `/api/follows/${b.userId}`,
      headers: { authorization: `Bearer ${a.token}` },
    });

    const profileAfterUnfollow = await app.inject({
      method: "GET",
      url: "/api/users/followedx",
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(profileAfterUnfollow.json().user.followersCount).toBe(0);
  });
});