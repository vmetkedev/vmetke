import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { eq, and, count } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, follows, posts, comments, likes, bookmarks, refreshTokens } from "../db/schema/index.js";

export class InvalidPasswordError extends Error {}
export class UserNotFoundError extends Error {}

export async function getUserProfile(username: string, viewerId: string | null) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.username, username));

  if (!user) return null;

  const [{ followersCount }] = await db
    .select({ followersCount: count() })
    .from(follows)
    .where(eq(follows.followingId, user.id));

  const [{ followingCount }] = await db
    .select({ followingCount: count() })
    .from(follows)
    .where(eq(follows.followerId, user.id));

  let isFollowedByMe = false;
  if (viewerId) {
    const [followRow] = await db
      .select()
      .from(follows)
      .where(and(eq(follows.followerId, viewerId), eq(follows.followingId, user.id)));
    isFollowedByMe = !!followRow;
  }

  return {
    ...user,
    isDeleted: !!user.deletedAt,
    followersCount,
    followingCount,
    isFollowedByMe,
    isMe: viewerId === user.id,
  };
}

export async function deleteAccount(userId: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new UserNotFoundError("Пользователь не найден");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new InvalidPasswordError("Неверный пароль");

  const dummyHash = await bcrypt.hash(crypto.randomUUID(), 10);

  const anonymizedUsername = `deleted_${user.id.replace(/-/g, "").slice(0, 24)}`;

  await db
    .update(users)
    .set({
      email: `deleted_${user.id}@vmetke.local`,
      username: anonymizedUsername,
      displayName: null,
      bio: null,
      passwordHash: dummyHash,
      deletedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.userId, userId));
}

export async function exportUserData(userId: string) {
  const [profile] = await db.select().from(users).where(eq(users.id, userId));
  if (!profile) throw new UserNotFoundError("Пользователь не найден");

  const [userPosts, userComments, userLikes, userBookmarks, following, followers] = await Promise.all([
    db.select().from(posts).where(eq(posts.authorId, userId)),
    db.select().from(comments).where(eq(comments.authorId, userId)),
    db.select().from(likes).where(eq(likes.userId, userId)),
    db.select().from(bookmarks).where(eq(bookmarks.userId, userId)),
    db.select().from(follows).where(eq(follows.followerId, userId)),
    db.select().from(follows).where(eq(follows.followingId, userId)),
  ]);

  return {
    profile: {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      createdAt: profile.createdAt,
    },
    posts: userPosts,
    comments: userComments,
    likes: userLikes,
    bookmarks: userBookmarks,
    following,
    followers,
  };
}