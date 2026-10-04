import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { conversations, messages, users } from "../db/schema/index.js";

export class MessagingError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const isLow = (conv: { userLowId: string }, me: string) => conv.userLowId === me;

async function getConversationFor(conversationId: number, me: string) {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        or(eq(conversations.userLowId, me), eq(conversations.userHighId, me)),
      ),
    );
  // 404 и для чужого диалога, чтобы не раскрывать его существование
  if (!conv) throw new MessagingError(404, "Диалог не найден");
  return conv;
}

export async function getOrCreateConversation(me: string, otherId: string) {
  if (me === otherId) throw new MessagingError(400, "Нельзя написать самому себе");

  const [other] = await db.select({ id: users.id }).from(users).where(eq(users.id, otherId));
  if (!other) throw new MessagingError(404, "Пользователь не найден");

  const low = me < otherId ? me : otherId;
  const high = me < otherId ? otherId : me;

  await db.insert(conversations).values({ userLowId: low, userHighId: high }).onConflictDoNothing();

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userLowId, low), eq(conversations.userHighId, high)));
  return conv;
}

export async function listConversations(me: string) {
  const otherId = sql<string>`CASE WHEN ${conversations.userLowId} = ${me} THEN ${conversations.userHighId} ELSE ${conversations.userLowId} END`;

  return db
    .select({
      id: conversations.id,
      otherUser: { id: users.id, username: users.username },
      lastMessage: {
        id: messages.id,
        content: messages.content,
        senderId: messages.senderId,
        createdAt: messages.createdAt,
      },
      unreadCount: sql<number>`(
        SELECT count(*)::int FROM ${messages} AS m
        WHERE m.conversation_id = ${conversations.id}
          AND m.sender_id <> ${me}
          AND m.id > COALESCE(
            CASE WHEN ${conversations.userLowId} = ${me}
              THEN ${conversations.lastReadLowId}
              ELSE ${conversations.lastReadHighId} END, 0)
      )`,
    })
    .from(conversations)
    .innerJoin(users, sql`${users.id} = ${otherId}`)
    .innerJoin(messages, eq(messages.id, conversations.lastMessageId))
    .where(or(eq(conversations.userLowId, me), eq(conversations.userHighId, me)))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getMessages(
  conversationId: number,
  me: string,
  before: number | undefined,
  limit: number,
) {
  await getConversationFor(conversationId, me);

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        before ? lt(messages.id, before) : undefined,
      ),
    )
    .orderBy(desc(messages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { messages: items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export async function sendMessage(conversationId: number, me: string, content: string) {
  const conv = await getConversationFor(conversationId, me);

  return db.transaction(async (tx) => {
    const [msg] = await tx
      .insert(messages)
      .values({ conversationId, senderId: me, content })
      .returning();

    // Своё сообщение автоматически считается прочитанным отправителем
    await tx
      .update(conversations)
      .set({
        lastMessageId: msg.id,
        lastMessageAt: msg.createdAt,
        ...(isLow(conv, me) ? { lastReadLowId: msg.id } : { lastReadHighId: msg.id }),
      })
      .where(eq(conversations.id, conversationId));

    return msg;
  });
}

export async function markRead(conversationId: number, me: string) {
  const conv = await getConversationFor(conversationId, me);
  if (!conv.lastMessageId) return;

  const low = isLow(conv, me);
  const col = low ? conversations.lastReadLowId : conversations.lastReadHighId;
  const value = sql`GREATEST(COALESCE(${col}, 0), ${conv.lastMessageId})`;

  await db
    .update(conversations)
    .set(low ? { lastReadLowId: value } : { lastReadHighId: value })
    .where(eq(conversations.id, conversationId));
}