import { asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { comments, users } from "../db/schema/index.js";

export async function createComment(postId: string, authorId: string, content: string) {
  const [inserted] = await db.insert(comments).values({ postId, authorId, content }).returning();

  const [full] = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.id, inserted.id));

  return full;
}

export async function getPostComments(postId: string) {
  return db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));
}