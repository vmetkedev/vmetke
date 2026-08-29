import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { likes } from "../db/schema/index.js";

export async function likePost(postId: string, userId: string) {
  await db.insert(likes).values({ postId, userId }).onConflictDoNothing();
}

export async function unlikePost(postId: string, userId: string) {
  await db.delete(likes).where(and(eq(likes.postId, postId), eq(likes.userId, userId)));
}