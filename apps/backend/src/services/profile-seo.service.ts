import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema/index.js";

export async function getProfileForSeo(username: string) {
  const [user] = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
      bannedAt: users.bannedAt,
    })
    .from(users)
    .where(eq(users.username, username));
  return user ?? null;
}