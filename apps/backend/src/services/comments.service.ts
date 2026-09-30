import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { comments, commentLikes, users, posts } from "../db/schema/index.js";
import { NotOwnerError, NotFoundError } from "./posts.service.js";
import { createNotification } from "./notifications.service.js";

const authorFields = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  avatarColor: users.avatarColor,
};

export async function createComment(postId: string, authorId: string, content: string) {
  const [inserted] = await db.insert(comments).values({ postId, authorId, content }).returning();

  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId));
  if (post) await createNotification(post.authorId, authorId, "comment", postId);

  const [full] = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      author: authorFields,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.id, inserted.id));

  return { ...full, likesCount: 0, isLikedByMe: false };
}


export async function getPostComments(postId: string, viewerId: string | null) {
  const likesCount = sql<number>`(select count(*)::int from ${commentLikes} where ${commentLikes.commentId} = ${comments.id})`;
  const isLikedByMe = viewerId
    ? sql<boolean>`exists (select 1 from ${commentLikes} where ${commentLikes.commentId} = ${comments.id} and ${commentLikes.userId} = ${viewerId})`
    : sql<boolean>`false`;

  return db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      author: authorFields,
      likesCount,
      isLikedByMe,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));
}

export async function likeComment(commentId: string, userId: string) {
  const [comment] = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, commentId));
  if (!comment) throw new NotFoundError("Комментарий не найден");
  await db.insert(commentLikes).values({ commentId, userId }).onConflictDoNothing();
}

export async function unlikeComment(commentId: string, userId: string) {
  await db
    .delete(commentLikes)
    .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)));
}

export async function deleteComment(commentId: string, userId: string) {
  const [comment] = await db.select().from(comments).where(eq(comments.id, commentId));
  if (!comment) throw new NotFoundError("Комментарий не найден");
  if (comment.authorId !== userId) throw new NotOwnerError("Нельзя удалить чужой комментарий");

  await db.delete(comments).where(eq(comments.id, commentId));
}