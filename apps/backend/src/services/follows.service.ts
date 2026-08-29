import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { follows } from "../db/schema/index.js";
import { createNotification } from "./notifications.service.js";

export class SelfFollowError extends Error {}

export async function followUser(followerId: string, followingId: string) {
  if (followerId === followingId) {
    throw new SelfFollowError("Нельзя подписаться на самого себя");
  }

  const result = await db
    .insert(follows)
    .values({ followerId, followingId })
    .onConflictDoNothing()
    .returning();

  if (result.length > 0) {
    await createNotification(followingId, followerId, "follow");
  }
}

export async function unfollowUser(followerId: string, followingId: string) {
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
}