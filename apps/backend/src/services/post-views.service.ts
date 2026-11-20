import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { posts, postViews } from "../db/schema/index.js";

/** Регистрирует просмотр. Возвращает true, если этот зритель увидел пост впервые. */
export async function registerPostView(postId: string, viewerKey: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(postViews)
      .values({ postId, viewerKey })
      .onConflictDoNothing()
      .returning({ postId: postViews.postId });

    if (inserted.length === 0) return false;

    await tx
      .update(posts)
      .set({ views: sql`${posts.views} + 1` })
      .where(eq(posts.id, postId));
    return true;
  });
}