import { asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { comments, users, posts } from "../db/schema/index.js";
import { NotOwnerError, NotFoundError } from "./posts.service.js";
import { createNotification } from "./notifications.service.js";

export async function createComment(postId: string, authorId: string, content: string) {
  const [inserted] = await db.insert(comments).values({ postId, authorId, content }).returning();

  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId));
  if (post) await createNotification(post.authorId, authorId, "comment", postId);

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

export async function deleteComment(commentId: string, userId: string) {
  const [comment] = await db.select().from(comments).where(eq(comments.id, commentId));
  if (!comment) throw new NotFoundError("Комментарий не найден");
  if (comment.authorId !== userId) throw new NotOwnerError("Нельзя удалить чужой комментарий");

  await db.delete(comments).where(eq(comments.id, commentId));
}