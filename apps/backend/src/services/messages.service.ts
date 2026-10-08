import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { conversations, messages, userBlocks, users } from "../db/schema/index.js";

export class MessagingError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

type Conv = typeof conversations.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
export type DeleteScope = "me" | "all";

const isLow = (conv: { userLowId: string }, me: string) => conv.userLowId === me;

// Отметка «удалено у меня»: сообщения с id <= этого значения мне не показываются
const clearedFor = (conv: Conv, me: string) =>
  (isLow(conv, me) ? conv.clearedLowId : conv.clearedHighId) ?? 0;

// Удалённое сообщение остаётся в истории как «надгробие» без текста
function serializeMessage(m: MessageRow) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    content: m.deletedAt ? "" : m.content,
    createdAt: m.createdAt,
    deleted: m.deletedAt !== null,
  };
}

const otherOf = (conv: { userLowId: string; userHighId: string }, me: string) =>
  isLow(conv, me) ? conv.userHighId : conv.userLowId;

async function blockState(me: string, otherId: string) {
  const rows = await db
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, otherId)),
        and(eq(userBlocks.blockerId, otherId), eq(userBlocks.blockedId, me)),
      ),
    );
  return {
    blockedByMe: rows.some((r) => r.blockerId === me),
    blockedMe: rows.some((r) => r.blockerId === otherId),
  };
}

function assertCanMessage(s: { blockedByMe: boolean; blockedMe: boolean }) {
  if (s.blockedByMe) {
    throw new MessagingError(403, "Вы заблокировали этого пользователя. Разблокируйте его, чтобы написать");
  }
  if (s.blockedMe) throw new MessagingError(403, "Этому пользователю нельзя отправить сообщение");
}

async function getConversationFor(conversationId: number, me: string) {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        isNull(conversations.deletedAt),
        or(eq(conversations.userLowId, me), eq(conversations.userHighId, me)),
      ),
    );
  // 404 и для чужого/удалённого диалога, чтобы не раскрывать его существование
  if (!conv) throw new MessagingError(404, "Диалог не найден");
  return conv;
}

export async function getOrCreateConversation(me: string, otherId: string) {
  if (me === otherId) throw new MessagingError(400, "Нельзя написать самому себе");

  const [other] = await db.select({ id: users.id }).from(users).where(eq(users.id, otherId));
  if (!other) throw new MessagingError(404, "Пользователь не найден");

  const low = me < otherId ? me : otherId;
  const high = me < otherId ? otherId : me;

  const findActive = () =>
    db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.userLowId, low),
          eq(conversations.userHighId, high),
          isNull(conversations.deletedAt),
        ),
      );

  const [existing] = await findActive();
  if (existing) return existing;

  assertCanMessage(await blockState(me, otherId));

  // Конфликт возможен только с живым диалогом (частичный уникальный индекс)
  await db.insert(conversations).values({ userLowId: low, userHighId: high }).onConflictDoNothing();

  const [conv] = await findActive();
  return conv;
}

export async function listConversations(me: string) {
  const otherId = sql<string>`CASE WHEN ${conversations.userLowId} = ${me} THEN ${conversations.userHighId} ELSE ${conversations.userLowId} END`;
  const myCleared = sql`COALESCE(CASE WHEN ${conversations.userLowId} = ${me} THEN ${conversations.clearedLowId} ELSE ${conversations.clearedHighId} END, 0)`;

  const rows = await db
    .select({
      id: conversations.id,
      otherUser: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarColor: users.avatarColor,
      },
      lastMessage: {
        id: messages.id,
        content: messages.content,
        senderId: messages.senderId,
        createdAt: messages.createdAt,
        deletedAt: messages.deletedAt,
      },
      unreadCount: sql<number>`(
        SELECT count(*)::int FROM ${messages} AS m
        WHERE m.conversation_id = ${conversations.id}
          AND m.sender_id <> ${me}
          AND m.deleted_at IS NULL
          AND m.id > COALESCE(
            CASE WHEN ${conversations.userLowId} = ${me}
              THEN ${conversations.lastReadLowId}
              ELSE ${conversations.lastReadHighId} END, 0)
      )`,
      blockedByMe: sql<boolean>`EXISTS (
        SELECT 1 FROM ${userBlocks}
        WHERE ${userBlocks.blockerId} = ${me}
          AND ${userBlocks.blockedId} = ${otherId}
      )`,
    })
    .from(conversations)
    .innerJoin(users, sql`${users.id} = ${otherId}`)
    .innerJoin(messages, eq(messages.id, conversations.lastMessageId))
    .where(
      and(
        or(eq(conversations.userLowId, me), eq(conversations.userHighId, me)),
        isNull(conversations.deletedAt),
        // Диалог, очищенный «у меня», скрыт, пока не придёт новое сообщение
        sql`${conversations.lastMessageId} > ${myCleared}`,
      ),
    )
    .orderBy(desc(conversations.lastMessageAt));

  return rows.map(({ lastMessage, ...rest }) => ({
    ...rest,
    lastMessage: {
      id: lastMessage.id,
      content: lastMessage.deletedAt ? "" : lastMessage.content,
      senderId: lastMessage.senderId,
      createdAt: lastMessage.createdAt,
      deleted: lastMessage.deletedAt !== null,
    },
  }));
}

export async function getMessages(
  conversationId: number,
  me: string,
  before: number | undefined,
  limit: number,
) {
  const conv = await getConversationFor(conversationId, me);

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        gt(messages.id, clearedFor(conv, me)),
        before ? lt(messages.id, before) : undefined,
      ),
    )
    .orderBy(desc(messages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const { blockedByMe } = await blockState(me, otherOf(conv, me));
  return {
    messages: items.map(serializeMessage),
    nextCursor: hasMore ? items[items.length - 1].id : null,
    blockedByMe,
  };
}

export async function sendMessage(conversationId: number, me: string, content: string) {
  const conv = await getConversationFor(conversationId, me);
  assertCanMessage(await blockState(me, otherOf(conv, me)));

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

    return serializeMessage(msg);
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

// Удаление своего сообщения у всех (soft delete). Повторное удаление идемпотентно.
export async function deleteMessage(conversationId: number, messageId: number, me: string) {
  const conv = await getConversationFor(conversationId, me);

  const [msg] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.conversationId, conversationId),
        // сообщение из очищенной «у меня» части истории я не вижу, значит, и удалить не могу
        gt(messages.id, clearedFor(conv, me)),
      ),
    );
  if (!msg) throw new MessagingError(404, "Сообщение не найдено");
  if (msg.senderId !== me) throw new MessagingError(403, "Можно удалять только свои сообщения");
  if (msg.deletedAt) return;

  await db.transaction(async (tx) => {
    await tx.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, messageId));

    if (conv.lastMessageId !== messageId) return;

    // Удалили последнее сообщение: превью диалога переключаем на предыдущее живое.
    // Если живых нет, lastMessageId = null, и диалог скрывается из списка.
    const [prev] = await tx
      .select({ id: messages.id, createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)))
      .orderBy(desc(messages.id))
      .limit(1);

    // Условие на lastMessageId защищает от гонки с новым сообщением
    await tx
      .update(conversations)
      .set({ lastMessageId: prev?.id ?? null, lastMessageAt: prev?.createdAt ?? null })
      .where(and(eq(conversations.id, conversationId), eq(conversations.lastMessageId, messageId)));
  });
}

export async function deleteConversation(conversationId: number, me: string, scope: DeleteScope) {
  const conv = await getConversationFor(conversationId, me);

  if (scope === "all") {
    await db
      .update(conversations)
      .set({ deletedAt: new Date() })
      .where(eq(conversations.id, conversationId));
    return;
  }

  // «У меня»: прячем всю историю до последнего сообщения и считаем её прочитанной
  if (!conv.lastMessageId) return;
  const cleared = conv.lastMessageId;
  await db
    .update(conversations)
    .set(
      isLow(conv, me)
        ? { clearedLowId: cleared, lastReadLowId: cleared }
        : { clearedHighId: cleared, lastReadHighId: cleared },
    )
    .where(eq(conversations.id, conversationId));
}

export async function blockUser(me: string, targetId: string) {
  if (me === targetId) throw new MessagingError(400, "Нельзя заблокировать самого себя");

  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId));
  if (!target) throw new MessagingError(404, "Пользователь не найден");

  await db.insert(userBlocks).values({ blockerId: me, blockedId: targetId }).onConflictDoNothing();
}

export async function unblockUser(me: string, targetId: string) {
  await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, targetId)));
}

export async function listBlockedUsers(me: string) {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarColor: users.avatarColor,
      blockedAt: userBlocks.createdAt,
    })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedId))
    .where(eq(userBlocks.blockerId, me))
    .orderBy(desc(userBlocks.createdAt));
}