import { and, count, desc, eq, gt, gte, isNull, lt, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { sendTelegramAlert, telegramConfigured } from "./telegram.service.js";
import {
  comments,
  conversations,
  messages,
  posts,
  reports,
  users,
  type ReportReason,
  type ReportTargetType,
} from "../db/schema/index.js";

export class ReportError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const MAX_REPORTS_PER_HOUR = 10;
const MESSAGE_CONTEXT_SIZE = 4;

type Built = { targetUserId: string; snapshot: Record<string, unknown> };

export function normalizeTargetId(type: ReportTargetType, raw: string) {
  return type === "message" ? String(Number(raw)) : raw.toLowerCase();
}

async function buildSnapshot(reporterId: string, type: ReportTargetType, targetId: string): Promise<Built> {
  if (type === "post") {
    const [p] = await db
      .select({
        id: posts.id,
        authorId: posts.authorId,
        authorUsername: users.username,
        title: posts.title,
        content: posts.content,
        tags: posts.tags,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.id, targetId));
    if (!p) throw new ReportError(404, "Пост не найден");
    if (p.authorId === reporterId) throw new ReportError(400, "Нельзя пожаловаться на свой пост");
    return { targetUserId: p.authorId, snapshot: p };
  }

  if (type === "comment") {
    const [c] = await db
      .select({
        id: comments.id,
        postId: comments.postId,
        authorId: comments.authorId,
        authorUsername: users.username,
        content: comments.content,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.id, targetId));
    if (!c) throw new ReportError(404, "Комментарий не найден");
    if (c.authorId === reporterId) throw new ReportError(400, "Нельзя пожаловаться на свой комментарий");
    return { targetUserId: c.authorId, snapshot: c };
  }

  if (type === "user") {
    const [u] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        bio: users.bio,
        createdAt: users.createdAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, targetId));
    if (!u || u.deletedAt) throw new ReportError(404, "Пользователь не найден");
    if (u.id === reporterId) throw new ReportError(400, "Нельзя пожаловаться на себя");
    const { deletedAt: _omit, ...snapshot } = u;
    return { targetUserId: u.id, snapshot };
  }

  // message: жалобщик должен быть участником диалога и видеть это сообщение
  const notFound = new ReportError(404, "Сообщение не найдено");
  const [row] = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      senderUsername: users.username,
      content: messages.content,
      createdAt: messages.createdAt,
      editedAt: messages.editedAt,
      deletedAt: messages.deletedAt,
      userLowId: conversations.userLowId,
      userHighId: conversations.userHighId,
      clearedLowId: conversations.clearedLowId,
      clearedHighId: conversations.clearedHighId,
      conversationDeletedAt: conversations.deletedAt,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.id, Number(targetId)));

  if (!row || row.deletedAt || row.conversationDeletedAt) throw notFound;
  const isLow = row.userLowId === reporterId;
  if (!isLow && row.userHighId !== reporterId) throw notFound;
  const cleared = isLow ? row.clearedLowId : row.clearedHighId;
  if (cleared != null && row.id <= cleared) throw notFound;
  if (row.senderId === reporterId) throw new ReportError(400, "Нельзя пожаловаться на своё сообщение");

  const context = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      senderUsername: users.username,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(
      and(
        eq(messages.conversationId, row.conversationId),
        lt(messages.id, row.id),
        isNull(messages.deletedAt),
        cleared != null ? gt(messages.id, cleared) : undefined,
      ),
    )
    .orderBy(desc(messages.id))
    .limit(MESSAGE_CONTEXT_SIZE);

  return {
    targetUserId: row.senderId,
    snapshot: {
      conversationId: row.conversationId,
      message: {
        id: row.id,
        senderId: row.senderId,
        senderUsername: row.senderUsername,
        content: row.content,
        createdAt: row.createdAt,
        editedAt: row.editedAt,
      },
      context: context.reverse(),
    },
  };
}

function isUniqueViolation(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

const TARGET_RU: Record<ReportTargetType, string> = {
  post: "пост",
  comment: "комментарий",
  user: "пользователь",
  message: "личное сообщение",
};
const REASON_RU: Record<ReportReason, string> = {
  spam: "Спам или реклама",
  abuse: "Оскорбления или травля",
  illegal: "Незаконный контент",
  other: "Другое",
};

// Не больше ALERT_MAX алертов за окно на весь сервер: защита чата от флуда
const ALERT_WINDOW_MS = 10 * 60 * 1000;
const ALERT_MAX = 10;
let alertTimes: number[] = [];

export function resetReportAlertThrottle() {
  alertTimes = [];
}

function allowAlert() {
  const now = Date.now();
  alertTimes = alertTimes.filter((t) => now - t < ALERT_WINDOW_MS);
  if (alertTimes.length >= ALERT_MAX) return false;
  alertTimes.push(now);
  return true;
}

/** Алерт о новой жалобе. Без содержимого жалобы; никогда не бросает исключений. */
async function notifyNewReport(r: {
  id: string;
  reporterId: string;
  targetUserId: string;
  targetType: ReportTargetType;
  reason: ReportReason;
  comment: string | null;
}) {
  try {
    if (!telegramConfigured() || !allowAlert()) return;

    const names = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, [r.reporterId, r.targetUserId]));
    const name = (id: string) => `@${names.find((n) => n.id === id)?.username ?? "?"}`;

    const base = process.env.NODE_ENV === "production" ? "https://vmetke.ru" : "http://localhost:5173";
    const lines = [
      `🚩 Новая жалоба: ${TARGET_RU[r.targetType]}`,
      `Причина: ${REASON_RU[r.reason]}`,
      `От: ${name(r.reporterId)} → на: ${name(r.targetUserId)}`,
    ];
    if (r.comment) lines.push(`«${r.comment.slice(0, 200)}»`);
    lines.push(`${base}/admin/reports/${r.id}`);

    await sendTelegramAlert(lines.join("\n"));
  } catch {
    // алерты не должны влиять на создание жалобы
  }
}

export async function createReport(
  reporterId: string,
  input: { targetType: ReportTargetType; targetId: string; reason: ReportReason; comment: string | null },
) {
  const targetId = normalizeTargetId(input.targetType, input.targetId);

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [{ n }] = await db
    .select({ n: count() })
    .from(reports)
    .where(and(eq(reports.reporterId, reporterId), gte(reports.createdAt, since)));
  if (n >= MAX_REPORTS_PER_HOUR) throw new ReportError(429, "Слишком много жалоб. Попробуйте позже");

  const { targetUserId, snapshot } = await buildSnapshot(reporterId, input.targetType, targetId);

  const dupMessage = "Вы уже отправили жалобу, она на рассмотрении";
  const [dup] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, reporterId),
        eq(reports.targetType, input.targetType),
        eq(reports.targetId, targetId),
        eq(reports.status, "open"),
      ),
    );
  if (dup) throw new ReportError(409, dupMessage);

  try {
    const [row] = await db
      .insert(reports)
      .values({
        reporterId,
        targetType: input.targetType,
        targetId,
        targetUserId,
        reason: input.reason,
        comment: input.comment,
        snapshot,
      })
      .returning({ id: reports.id });
    void notifyNewReport({
      id: row.id,
      reporterId,
      targetUserId,
      targetType: input.targetType,
      reason: input.reason,
      comment: input.comment,
    });
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ReportError(409, dupMessage);
    throw err;
  }
}