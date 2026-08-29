import { and, desc, eq, count } from "drizzle-orm";
import { db } from "../db/client.js";
import { notifications, users } from "../db/schema/index.js";

type NotificationType = "like" | "comment" | "follow";

export async function createNotification(
  userId: string,
  actorId: string,
  type: NotificationType,
  postId?: string
) {
  if (userId === actorId) return; // не уведомляем самого себя

  await db.insert(notifications).values({ userId, actorId, type, postId: postId ?? null });
}

export async function getNotifications(userId: string, limit = 30) {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      postId: notifications.postId,
      read: notifications.read,
      createdAt: notifications.createdAt,
      actor: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      },
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.actorId, users.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadCount(userId: string) {
  const [{ unread }] = await db
    .select({ unread: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return unread;
}

export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
}

export async function deleteNotification(notificationId: string, userId: string) {
  await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}