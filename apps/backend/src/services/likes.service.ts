import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { likes, posts } from "../db/schema/index.js";
import { createNotification } from "./notifications.service.js";
import { NotFoundError } from "./posts.service.js";

export async function likePost(postId: string, userId: string) {
  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId));
  if (!post) throw new NotFoundError("Пост не найден");

  const result = await db.insert(likes).values({ postId, userId }).onConflictDoNothing().returning();

  if (result.length > 0) {
    await createNotification(post.authorId, userId, "like", postId);
  }
}

export async function unlikePost(postId: string, userId: string) {
  await db.delete(likes).where(and(eq(likes.postId, postId), eq(likes.userId, userId)));
}