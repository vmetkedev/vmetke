import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { bookmarks } from "../db/schema/index.js";

export async function bookmarkPost(postId: string, userId: string) {
  await db.insert(bookmarks).values({ postId, userId }).onConflictDoNothing();
}

export async function unbookmarkPost(postId: string, userId: string) {
  await db.delete(bookmarks).where(and(eq(bookmarks.postId, postId), eq(bookmarks.userId, userId)));
}