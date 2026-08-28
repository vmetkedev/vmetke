import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { follows } from "../db/schema/index.js";

export class SelfFollowError extends Error {}

export async function followUser(followerId: string, followingId: string) {
  if (followerId === followingId) {
    throw new SelfFollowError("Нельзя подписаться на самого себя");
  }

  await db
    .insert(follows)
    .values({ followerId, followingId })
    .onConflictDoNothing();
}

export async function unfollowUser(followerId: string, followingId: string) {
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
}