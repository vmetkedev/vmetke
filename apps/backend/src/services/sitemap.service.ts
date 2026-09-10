import { desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { posts } from "../db/schema/index.js";

export async function getAllPostsForSitemap() {
  return db
    .select({ id: posts.id, createdAt: posts.createdAt })
    .from(posts)
    .orderBy(desc(posts.createdAt));
}