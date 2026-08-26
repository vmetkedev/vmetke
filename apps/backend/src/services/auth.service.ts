import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users, refreshTokens } from "../db/schema";
import type { RegisterInput, LoginInput } from "../schemas/auth";

const REFRESH_TOKEN_TTL_DAYS = 30;

export async function registerUser(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, 10);

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      username: input.username,
      passwordHash,
    })
    .returning();

  return user;
}

export async function validateCredentials(input: LoginInput) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email));

  if (!user) return null;

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) return null;

  return user;
}

export async function createRefreshToken(userId: string) {
  const rawToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return rawToken;
}

export async function rotateRefreshToken(rawToken: string) {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const [existing] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));

  if (!existing || existing.revoked || existing.expiresAt < new Date()) {
    return null;
  }

  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.id, existing.id));

  const newToken = await createRefreshToken(existing.userId);
  return { userId: existing.userId, token: newToken };
}

export async function revokeRefreshToken(rawToken: string) {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.tokenHash, tokenHash));
}