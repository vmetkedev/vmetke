import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "../db/client.js";
import { posts, comments, likes, users, adminAuditLog, type UserRole } from "../db/schema/index.js";
import { AdminActionError } from "./admin-users.service.js";


export type ContentListParams = {
  q?: string;
  author?: string; // точное совпадение username без учёта регистра
  from?: string; // YYYY-MM-DD, включительно, UTC
  to?: string; // YYYY-MM-DD, включительно, UTC
  cursor?: string;
  limit: number;
};

export type Actor = { id: string; role: UserRole };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const dayStart = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dayAfter = (d: string) => {
  const x = dayStart(d);
  x.setUTCDate(x.getUTCDate() + 1);
  return x;
};

function dateConditions(column: AnyPgColumn, p: ContentListParams): SQL[] {
  const out: SQL[] = [];
  if (p.from) out.push(gte(column, dayStart(p.from)));
  if (p.to) out.push(lt(column, dayAfter(p.to)));
  return out;
}

function toPage<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

const likesCountSql = sql<number>`(select count(*)::int from ${likes} where ${likes.postId} = ${posts.id})`;
const commentsCountSql = sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id})`;
const authorFields = {
  id: users.id,
  username: users.username,
  avatarColor: users.avatarColor,
  role: users.role,
};

const postFields = {
  id: posts.id,
  title: posts.title,
  tags: posts.tags,
  views: posts.views,
  createdAt: posts.createdAt,
  likesCount: likesCountSql,
  commentsCount: commentsCountSql,
  author: authorFields,
};

export async function listPosts(p: ContentListParams) {
  const conditions: SQL[] = [...dateConditions(posts.createdAt, p)];
  if (p.q) {
    const pattern = `%${escapeLike(p.q)}%`;
    conditions.push(or(ilike(posts.title, pattern), ilike(posts.content, pattern))!);
  }
  if (p.author) conditions.push(ilike(users.username, escapeLike(p.author)));
  if (p.cursor) {
    conditions.push(
      sql`(${posts.createdAt}, ${posts.id}) < (select created_at, id from posts where id = ${p.cursor})`,
    );
  }

  const rows = await db
    .select({ ...postFields, excerpt: sql<string>`left(${posts.content}, 300)` })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(p.limit + 1);

  const { items, nextCursor } = toPage(rows, p.limit);
  return { posts: items, nextCursor };
}

export async function getPostDetail(id: string) {
  const [row] = await db
    .select({ ...postFields, content: posts.content })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, id));
  return row ?? null;
}

// Модератор удаляет контент обычных пользователей и свой.
// Контент модераторов и админов удаляет только админ.
function assertCanModerate(actor: Actor, authorId: string, authorRole: UserRole) {
  if (actor.role === "admin" || authorId === actor.id || authorRole === "user") return;
  throw new AdminActionError(403, "Контент модераторов и администраторов удаляет только администратор");
}

export async function deletePost(actor: Actor, postId: string, reason: string) {
  await db.transaction(async (tx) => {
    const [post] = await tx
      .select({
        id: posts.id,
        authorId: posts.authorId,
        authorUsername: users.username,
        authorRole: users.role,
        title: posts.title,
        content: posts.content,
        tags: posts.tags,
        views: posts.views,
        createdAt: posts.createdAt,
        likesCount: likesCountSql,
        commentsCount: commentsCountSql,
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.id, postId));
    if (!post) throw new AdminActionError(404, "Пост не найден");
    assertCanModerate(actor, post.authorId, post.authorRole);

    // Жёсткое удаление: комментарии, лайки, закладки и уведомления уходят каскадом
    await tx.delete(posts).where(eq(posts.id, postId));
    await tx.insert(adminAuditLog).values({
      adminId: actor.id,
      action: "post.delete",
      targetType: "post",
      targetId: postId,
      details: { reason, snapshot: post },
    });
  });
}

export async function listComments(p: ContentListParams) {
  const conditions: SQL[] = [...dateConditions(comments.createdAt, p)];
  if (p.q) conditions.push(ilike(comments.content, `%${escapeLike(p.q)}%`));
  if (p.author) conditions.push(ilike(users.username, escapeLike(p.author)));
  if (p.cursor) {
    conditions.push(
      sql`(${comments.createdAt}, ${comments.id}) < (select created_at, id from comments where id = ${p.cursor})`,
    );
  }

  const rows = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      author: authorFields,
      post: { id: posts.id, title: posts.title },
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(and(...conditions))
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .limit(p.limit + 1);

  const { items, nextCursor } = toPage(rows, p.limit);
  return { comments: items, nextCursor };
}

export async function deleteComment(actor: Actor, commentId: string, reason: string) {
  await db.transaction(async (tx) => {
    const [comment] = await tx
      .select({
        id: comments.id,
        postId: comments.postId,
        authorId: comments.authorId,
        authorUsername: users.username,
        authorRole: users.role,
        content: comments.content,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.id, commentId));
    if (!comment) throw new AdminActionError(404, "Комментарий не найден");
    assertCanModerate(actor, comment.authorId, comment.authorRole);

    await tx.delete(comments).where(eq(comments.id, commentId));
    await tx.insert(adminAuditLog).values({
      adminId: actor.id,
      action: "comment.delete",
      targetType: "comment",
      targetId: commentId,
      details: { reason, snapshot: comment },
    });
  });
}