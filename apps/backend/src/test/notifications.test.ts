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

async function likePost(app: FastifyInstance, postId: string, token: string) {
  return app.inject({
    method: "POST",
    url: `/api/posts/${postId}/like`,
    headers: { authorization: `Bearer ${token}` },
  });
}

async function getNotifications(app: FastifyInstance, token: string) {
  const res = await app.inject({
    method: "GET",
    url: "/api/notifications",
    headers: { authorization: `Bearer ${token}` },
  });
  return res.json();
}

describe("notifications", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns an empty list and zero unread count for a new user", async () => {
    const token = await registerAndLogin(app, "notifuser1");

    const body = await getNotifications(app, token);
    expect(body.notifications).toHaveLength(0);
    expect(body.unreadCount).toBe(0);
  });

  it("creates a notification for the post author when someone likes their post", async () => {
    const authorToken = await registerAndLogin(app, "notifauthor2");
    const likerToken = await registerAndLogin(app, "notifliker2");
    const postId = await createPost(app, authorToken);

    await likePost(app, postId, likerToken);

    const body = await getNotifications(app, authorToken);
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0].type).toBe("like");
    expect(body.notifications[0].postId).toBe(postId);
    expect(body.notifications[0].read).toBe(false);
    expect(body.notifications[0].actor.username).toBe("notifliker2");
    expect(body.unreadCount).toBe(1);
  });

  it("does not create a notification when a user likes their own post", async () => {
    const authorToken = await registerAndLogin(app, "notifauthor3");
    const postId = await createPost(app, authorToken);

    await likePost(app, postId, authorToken);

    const body = await getNotifications(app, authorToken);
    expect(body.notifications).toHaveLength(0);
    expect(body.unreadCount).toBe(0);
  });

  it("does not create a notification for the liker, only the post author", async () => {
    const authorToken = await registerAndLogin(app, "notifauthor4");
    const likerToken = await registerAndLogin(app, "notifliker4");
    const postId = await createPost(app, authorToken);

    await likePost(app, postId, likerToken);

    const likerNotifications = await getNotifications(app, likerToken);
    expect(likerNotifications.notifications).toHaveLength(0);
  });

  it("marks all notifications as read", async () => {
    const authorToken = await registerAndLogin(app, "notifauthor5");
    const likerToken = await registerAndLogin(app, "notifliker5");
    const postId = await createPost(app, authorToken);

    await likePost(app, postId, likerToken);

    const markRead = await app.inject({
      method: "POST",
      url: "/api/notifications/read",
      headers: { authorization: `Bearer ${authorToken}` },
    });
    expect(markRead.statusCode).toBe(200);
    expect(markRead.json().success).toBe(true);

    const body = await getNotifications(app, authorToken);
    expect(body.notifications[0].read).toBe(true);
    expect(body.unreadCount).toBe(0);
  });

  it("deletes a notification", async () => {
    const authorToken = await registerAndLogin(app, "notifauthor6");
    const likerToken = await registerAndLogin(app, "notifliker6");
    const postId = await createPost(app, authorToken);

    await likePost(app, postId, likerToken);
    const before = await getNotifications(app, authorToken);
    const notificationId = before.notifications[0].id;

    const del = await app.inject({
      method: "DELETE",
      url: `/api/notifications/${notificationId}`,
      headers: { authorization: `Bearer ${authorToken}` },
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().success).toBe(true);

    const after = await getNotifications(app, authorToken);
    expect(after.notifications).toHaveLength(0);
  });

  it("does not delete another user's notification", async () => {
    const authorToken = await registerAndLogin(app, "notifauthor7");
    const likerToken = await registerAndLogin(app, "notifliker7");
    const intruderToken = await registerAndLogin(app, "notifintruder7");
    const postId = await createPost(app, authorToken);

    await likePost(app, postId, likerToken);
    const before = await getNotifications(app, authorToken);
    const notificationId = before.notifications[0].id;

    const del = await app.inject({
      method: "DELETE",
      url: `/api/notifications/${notificationId}`,
      headers: { authorization: `Bearer ${intruderToken}` },
    });
    expect(del.statusCode).toBe(200);

    const after = await getNotifications(app, authorToken);
    expect(after.notifications).toHaveLength(1);
  });

  it("rejects a malformed notification id on delete", async () => {
    const token = await registerAndLogin(app, "notifauthor8");

    const res = await app.inject({
      method: "DELETE",
      url: "/api/notifications/not-a-uuid",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects unauthenticated access to notification routes", async () => {
    const getRes = await app.inject({ method: "GET", url: "/api/notifications" });
    expect(getRes.statusCode).toBe(401);

    const readRes = await app.inject({ method: "POST", url: "/api/notifications/read" });
    expect(readRes.statusCode).toBe(401);

    const delRes = await app.inject({
      method: "DELETE",
      url: "/api/notifications/00000000-0000-0000-0000-000000000000",
    });
    expect(delRes.statusCode).toBe(401);
  });
});