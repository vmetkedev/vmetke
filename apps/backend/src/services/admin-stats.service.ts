import { count, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, posts, comments, conversations, messages } from "../db/schema/index.js";

export type AdminStats = {
  users: { total: number; last24h: number; last7d: number };
  posts: number;
  comments: number;
  conversations: number;
  messages: number;
  generatedAt: string;
};

const TTL_MS = 60_000;
let cache: { at: number; promise: Promise<AdminStats> } | null = null;

export function resetStatsCache() {
  cache = null;
}

async function computeStats(): Promise<AdminStats> {
  const [[u], [p], [c], [cv], [m]] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*) filter (where ${users.deletedAt} is null)`.mapWith(Number),
        last24h: sql<number>`count(*) filter (where ${users.deletedAt} is null and ${users.createdAt} >= now() - interval '24 hours')`.mapWith(Number),
        last7d: sql<number>`count(*) filter (where ${users.deletedAt} is null and ${users.createdAt} >= now() - interval '7 days')`.mapWith(Number),
      })
      .from(users),
    db.select({ n: count() }).from(posts),
    db.select({ n: count() }).from(comments),
    db.select({ n: count() }).from(conversations),
    db.select({ n: count() }).from(messages),
  ]);

  return {
    users: { total: u.total, last24h: u.last24h, last7d: u.last7d },
    posts: p.n,
    comments: c.n,
    conversations: cv.n,
    messages: m.n,
    generatedAt: new Date().toISOString(),
  };
}

/** Кэш на 60 секунд. Хранится промис, чтобы параллельные запросы не считали одно и то же. */
export function getAdminStats(): Promise<AdminStats> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.promise;

  const promise = computeStats();
  cache = { at: now, promise };
  promise.catch(() => {
    if (cache?.promise === promise) cache = null; // не кэшируем ошибку
  });
  return promise;
}