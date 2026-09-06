import "./env.js";
import { beforeEach } from "vitest";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE
    notifications, bookmarks, comments, likes, follows, posts, refresh_tokens, users
    RESTART IDENTITY CASCADE`);
});