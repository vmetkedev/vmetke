import { eq, and, count } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, follows } from "../db/schema/index.js";

export async function getUserProfile(username: string, viewerId: string | null) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      createdAt: users.createdAt,
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
    followersCount,
    followingCount,
    isFollowedByMe,
    isMe: viewerId === user.id,
  };
}