import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, Heart, Send, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { AppLayout } from "../components/AppLayout";
import { Avatar } from "../components/Avatar";
import { ConversationMenu } from "../components/ConversationMenu";
import { DeleteConversationModal } from "../components/DeleteConversationModal";
import { ForwardModal } from "../components/ForwardModal";
import { MessageMenu } from "../components/MessageMenu";
import {
  MAX_MESSAGE,
  blockUser,
  deleteConversation,
  deleteMessage,
  editMessage,
  fetchConversations,
  fetchMessages,
  forwardMessage,
  likeMessage,
  markConversationRead,
  sendMessage,
  unblockUser,
  unlikeMessage,
  type Conversation,
  type ConversationUser,
  type DeleteScope,
  type ForwardAuthor,
  type Message,
  type RequestError,
} from "../lib/messages";

const LIST_POLL_MS = 10000;
const THREAD_POLL_MS = 4000;

function isToday(d: Date) {
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function formatListDate(iso: string) {
  const d = new Date(iso);
  return isToday(d)
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatMessageTime(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return isToday(d)
    ? time
    : `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}, ${time}`;
}

function mergeMessages(prev: Message[], incoming: Message[]): Message[] {
  const map = new Map<number, Message>();
  for (const m of prev) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.id - b.id);
}

function Thread({
  conversationId,
  conversations,
  otherUser,
  myId,
  onChanged,
}: {
  conversationId: number;
  conversations: Conversation[];
  otherUser: ConversationUser | null;
  myId: string;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [menu, setMenu] = useState<{ id: number; mine: boolean; anchor: DOMRect } | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [forwardError, setForwardError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const prevScrollHeight = useRef<number | null>(null);
  const lastMarkedId = useRef(0);
  // Сообщения, скрытые «у меня»: защищают от «воскрешения» опросом, начатым до удаления
  const hiddenIds = useRef<Set<number>>(new Set());
  // Что было в поле ввода до входа в режим правки
  const draftBeforeEdit = useRef("");
  // Сообщения, у которых лайк сейчас в полёте: повторные нажатия игнорируем
  const likeBusy = useRef<Set<number>>(new Set());

  const visibleMessages = messages.filter((m) => !m.deleted && !hiddenIds.current.has(m.id));
  const otherName = otherUser ? otherUser.displayName || otherUser.username : undefined;
  // Если оригинал пропал (удалён или скрыт), пока я писал ответ, плашка исчезает
  const activeReply =
    replyTo && visibleMessages.some((m) => m.id === replyTo.id) ? replyTo : null;
  const authorName = (senderId: string | null) =>
    senderId === myId ? "Вы" : (otherName ?? "Собеседник");
  const forwardName = (a: ForwardAuthor) => (a.id === myId ? "Вы" : a.displayName || a.username);
  const menuTarget = menu ? messages.find((m) => m.id === menu.id) : undefined;
  const menuLiked = menuTarget?.likes?.likedByMe === true;

  const markIfNeeded = useCallback(
    (list: Message[]) => {
      const incoming = list.filter((m) => m.senderId !== myId);
      const last = incoming[incoming.length - 1];
      if (!last || last.id <= lastMarkedId.current) return;
      lastMarkedId.current = last.id;
      markConversationRead(conversationId)
        .then(onChanged)
        .catch(() => {});
    },
    [conversationId, myId, onChanged],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async (initial: boolean) => {
      try {
        const data = await fetchMessages(conversationId);
        if (cancelled) return;
        const asc = [...data.messages].reverse();
        setMessages((prev) => mergeMessages(prev, asc));
        if (initial) setNextCursor(data.nextCursor);
        markIfNeeded(asc);
        setBlockedByMe(data.blockedByMe === true);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        if (initial) {
          setError((e as Error).message);
        } else if ((e as RequestError).status === 404) {
          // собеседник удалил диалог у всех
          onChanged();
          navigate("/messages", { replace: true });
        }
      } finally {
        if (initial && !cancelled) setLoading(false);
      }
    };

    load(true);
    const interval = setInterval(() => load(false), THREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [conversationId, markIfNeeded, navigate, onChanged]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevScrollHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prevScrollHeight.current;
      prevScrollHeight.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Редактируемое сообщение пропало (например, я удалил его из меню): выходим из правки
  useEffect(() => {
    if (!editing) return;
    const alive = messages.some(
      (m) => m.id === editing.id && !m.deleted && !hiddenIds.current.has(m.id),
    );
    if (!alive) {
      setEditing(null);
      setText(draftBeforeEdit.current);
      draftBeforeEdit.current = "";
    }
  }, [editing, messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (menu) setMenu(null);
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchMessages(conversationId, nextCursor);
      prevScrollHeight.current = scrollRef.current?.scrollHeight ?? null;
      stickToBottom.current = false;
      setMessages((prev) => mergeMessages(prev, [...data.messages].reverse()));
      setNextCursor(data.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setText(draftBeforeEdit.current);
    draftBeforeEdit.current = "";
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;

    // Текст не изменился: выходим из правки без запроса
    if (editing && content === editing.content) {
      cancelEdit();
      return;
    }

    setSending(true);
    try {
      if (editing) {
        const updated = await editMessage(conversationId, editing.id, content);
        setMessages((prev) => mergeMessages(prev, [updated]));
        setEditing(null);
        setText(draftBeforeEdit.current);
        draftBeforeEdit.current = "";
      } else {
        const msg = activeReply
          ? await sendMessage(conversationId, content, activeReply.id)
          : await sendMessage(conversationId, content);
        stickToBottom.current = true;
        setMessages((prev) => mergeMessages(prev, [msg]));
        setText("");
        setReplyTo(null);
      }
      setError(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      if (editing) {
        cancelEdit();
        return;
      }
      if (replyTo) {
        setReplyTo(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteMessage = async (id: number, scope: DeleteScope) => {
    setMenu(null);
    try {
      await deleteMessage(conversationId, id, scope);
      if (scope === "me") {
        hiddenIds.current.add(id);
        setMessages((prev) => prev.filter((m) => m.id !== id));
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: "", deleted: true } : m)),
        );
      }
      setError(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleToggleLike = async (id: number) => {
    setMenu(null);
    const target = messages.find((m) => m.id === id);
    if (!target || likeBusy.current.has(id)) return;

    likeBusy.current.add(id);
    try {
      const likes =
        target.likes?.likedByMe === true
          ? await unlikeMessage(conversationId, id)
          : await likeMessage(conversationId, id);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, likes } : m)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      likeBusy.current.delete(id);
    }
  };

  const toggleMenu = (id: number, mine: boolean, el: HTMLElement) => {
    setMenu((cur) => (cur?.id === id ? null : { id, mine, anchor: el.getBoundingClientRect() }));
  };

  const handleReply = (id: number) => {
    const target = messages.find((m) => m.id === id);
    setMenu(null);
    if (!target) return;
    if (editing) cancelEdit();
    setReplyTo(target);
    inputRef.current?.focus();
  };

  const handleStartEdit = (id: number) => {
    const target = messages.find((m) => m.id === id);
    setMenu(null);
    if (!target || target.senderId !== myId || target.forwardedFrom) return;
    // Черновик запоминаем один раз: переход от правки к правке его не затирает
    if (!editing) draftBeforeEdit.current = text;
    setReplyTo(null);
    setEditing(target);
    setText(target.content);
    inputRef.current?.focus();
  };

  const handleStartForward = (id: number) => {
    const target = messages.find((m) => m.id === id);
    setMenu(null);
    if (!target) return;
    setForwardError(null);
    setForwarding(target);
  };

  const closeForward = () => {
    setForwarding(null);
    setForwardError(null);
  };

  const handleForward = async (toConversationId: number) => {
    if (!forwarding || forwardBusy) return;
    setForwardBusy(true);
    setForwardError(null);
    try {
      const sent = await forwardMessage(conversationId, forwarding.id, toConversationId);
      setForwardBusy(false);
      setForwarding(null);
      onChanged();
      if (toConversationId === conversationId) {
        stickToBottom.current = true;
        setMessages((prev) => mergeMessages(prev, [sent]));
      } else {
        // переходим в диалог получателя, чтобы было видно, что сообщение ушло
        navigate(`/messages/${toConversationId}`, {
          state: {
            otherUser: conversations.find((c) => c.id === toConversationId)?.otherUser,
          },
        });
      }
    } catch (e) {
      setForwardError((e as Error).message);
      setForwardBusy(false);
    }
  };

  const scrollToMessage = (id: number) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-message-id="${id}"]`);
    if (!el) return;
    stickToBottom.current = false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const handleDeleteConversation = async (scope: DeleteScope) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteConversation(conversationId, scope);
      onChanged();
      navigate("/messages", { replace: true });
    } catch (e) {
      setDeleteError((e as Error).message);
      setDeleting(false);
    }
  };

  const handleBlock = async () => {
    if (!otherUser || blockBusy) return;
    const name = otherUser.displayName || otherUser.username;
    if (
      !window.confirm(`Заблокировать ${name}? Переписка будет невозможна, пока вы не разблокируете.`)
    ) {
      return;
    }
    setBlockBusy(true);
    try {
      await blockUser(otherUser.id);
      setBlockedByMe(true);
      setError(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBlockBusy(false);
    }
  };

  const handleUnblock = async () => {
    if (!otherUser || blockBusy) return;
    setBlockBusy(true);
    try {
      await unblockUser(otherUser.id);
      setBlockedByMe(false);
      setError(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBlockBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b dark:border-gray-700">
        <Link to="/messages" className="md:hidden text-gray-500 dark:text-gray-400" aria-label="Назад">
          <ArrowLeft size={18} />
        </Link>
        {otherUser ? (
          <Link
            to={`/u/${otherUser.username}`}
            className="flex items-center gap-2 min-w-0 hover:underline dark:text-gray-100"
          >
            <Avatar
              username={otherUser.username}
              displayName={otherUser.displayName}
              avatarColor={otherUser.avatarColor}
              size="sm"
            />
            <span className="font-medium text-sm truncate">{otherName}</span>
          </Link>
        ) : (
          <span className="font-medium text-sm dark:text-gray-100">Диалог</span>
        )}
        <ConversationMenu
          blocked={blockedByMe}
          canBlock={otherUser !== null}
          busy={blockBusy}
          onBlockToggle={() => {
            if (blockedByMe) handleUnblock();
            else handleBlock();
          }}
          onDelete={() => setShowDelete(true)}
        />
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm py-8">Загрузка...</p>
        ) : (
          <>
            {nextCursor && (
              <div className="text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                >
                  {loadingMore ? "Загрузка..." : "Показать более ранние"}
                </button>
              </div>
            )}
            {visibleMessages.length === 0 && !error && (
              <p className="text-gray-500 dark:text-gray-400 text-center text-sm py-8">
                Сообщений пока нет. Напишите первым.
              </p>
            )}
            {visibleMessages.map((m) => {
              const mine = m.senderId === myId;
              const selected = menu?.id === m.id || editing?.id === m.id;
              const quote = m.replyTo ?? null;
              const forwardedFrom = m.forwardedFrom ?? null;
              const likes = m.likes ?? null;
              return (
                <div
                  key={m.id}
                  data-message-id={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    data-message-bubble
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      // выделение текста мышью не должно открывать меню
                      if (window.getSelection()?.toString()) return;
                      toggleMenu(m.id, mine, e.currentTarget);
                    }}
                    onKeyDown={(e) => {
                      // Enter на вложенной кнопке (сердечко) не должен открывать меню
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleMenu(m.id, mine, e.currentTarget);
                      }
                    }}
                    className={`max-w-[80%] cursor-pointer rounded-lg px-3 py-2 text-sm ${
                      mine
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 dark:text-gray-100"
                    } ${selected ? "ring-2 ring-blue-400" : ""}`}
                  >
                    {forwardedFrom && (
                      <p className="mb-1 truncate text-xs font-medium italic opacity-80">
                        Переслано от {forwardName(forwardedFrom)}
                      </p>
                    )}
                    {quote && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!quote.deleted) scrollToMessage(quote.id);
                        }}
                        className={`mb-1 rounded border-l-2 px-2 py-1 text-xs ${
                          mine
                            ? "border-blue-200 bg-blue-500/60"
                            : "border-gray-400 bg-gray-200 dark:bg-gray-600"
                        } ${quote.deleted ? "" : "cursor-pointer"}`}
                      >
                        {quote.deleted ? (
                          <p className="italic opacity-80">Сообщение удалено</p>
                        ) : (
                          <>
                            <p className="font-medium truncate">{authorName(quote.senderId)}</p>
                            <p className="line-clamp-2 whitespace-pre-wrap wrap-anywhere opacity-90">
                              {quote.content}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap wrap-anywhere">{m.content}</p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      {likes && likes.count > 0 ? (
                        <button
                          type="button"
                          aria-label={likes.likedByMe ? "Убрать лайк" : "Поставить лайк"}
                          aria-pressed={likes.likedByMe}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLike(m.id);
                          }}
                          className={`flex items-center gap-1 text-[11px] ${
                            likes.likedByMe ? (mine ? "text-red-300" : "text-red-500") : "opacity-60"
                          }`}
                        >
                          <Heart size={12} className="fill-current" />
                          {likes.count > 1 && <span>{likes.count}</span>}
                        </button>
                      ) : (
                        <span />
                      )}
                      <p
                        className={`ml-auto text-[10px] ${
                          mine ? "text-blue-100" : "text-gray-400 dark:text-gray-400"
                        }`}
                      >
                        {m.editedAt && <span className="mr-1">изменено</span>}
                        {formatMessageTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {error && <p className="px-4 pb-1 text-xs text-red-600">{error}</p>}

      {blockedByMe ? (
        <div className="flex items-center justify-between gap-3 p-3 border-t dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Вы заблокировали этого пользователя.
          </span>
          <button
            onClick={handleUnblock}
            disabled={blockBusy}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 shrink-0"
          >
            Разблокировать
          </button>
        </div>
      ) : (
        <div className="border-t dark:border-gray-700">
          {editing ? (
            <div className="flex items-center gap-2 px-3 pt-2 text-xs">
              <div className="flex-1 min-w-0 border-l-2 border-amber-500 pl-2">
                <p className="font-medium text-amber-600 dark:text-amber-400">Редактирование</p>
                <p className="truncate text-gray-500 dark:text-gray-400">{editing.content}</p>
              </div>
              <button
                onClick={cancelEdit}
                aria-label="Отменить редактирование"
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={14} />
              </button>
            </div>
          ) : activeReply ? (
            <div className="flex items-center gap-2 px-3 pt-2 text-xs">
              <div className="flex-1 min-w-0 border-l-2 border-blue-500 pl-2">
                <p className="font-medium text-blue-600 dark:text-blue-400 truncate">
                  {authorName(activeReply.senderId)}
                </p>
                <p className="truncate text-gray-500 dark:text-gray-400">{activeReply.content}</p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                aria-label="Отменить ответ"
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2 p-3">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={MAX_MESSAGE}
              rows={1}
              placeholder="Напишите сообщение..."
              className="flex-1 resize-none max-h-32 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              aria-label={editing ? "Сохранить" : "Отправить"}
              className="bg-blue-600 text-white rounded p-2.5 disabled:opacity-50"
            >
              {editing ? <Check size={16} /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}

      {menu && (
        <MessageMenu
          anchor={menu.anchor}
          mine={menu.mine}
          liked={menuLiked}
          canLike={!blockedByMe || menuLiked}
          canReply={!blockedByMe}
          canEdit={menu.mine && !blockedByMe && !menuTarget?.forwardedFrom}
          onClose={() => setMenu(null)}
          onToggleLike={() => handleToggleLike(menu.id)}
          onReply={() => handleReply(menu.id)}
          onForward={() => handleStartForward(menu.id)}
          onEdit={() => handleStartEdit(menu.id)}
          onDeleteForMe={() => handleDeleteMessage(menu.id, "me")}
          onDeleteForAll={() => handleDeleteMessage(menu.id, "all")}
        />
      )}

      {forwarding && (
        <ForwardModal
          conversations={conversations}
          preview={forwarding.content}
          busy={forwardBusy}
          error={forwardError}
          onClose={closeForward}
          onConfirm={handleForward}
        />
      )}

      <DeleteConversationModal
        open={showDelete}
        busy={deleting}
        error={deleteError}
        userName={otherName}
        onClose={() => {
          setShowDelete(false);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConversation}
      />
    </>
  );
}

export default function MessagesPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const location = useLocation();
  const parsedId = id ? Number(id) : null;
  const activeId = parsedId !== null && Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    try {
      const data = await fetchConversations();
      setConversations(data.conversations);
    } catch {
      // следующий poll попробует снова
    }
  }, []);

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
    const interval = setInterval(loadConversations, LIST_POLL_MS);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const stateUser = (location.state as { otherUser?: ConversationUser } | null)?.otherUser ?? null;
  const activeUser = conversations.find((c) => c.id === activeId)?.otherUser ?? stateUser;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 sm:p-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow flex h-[70vh] min-h-[400px] overflow-hidden">
          {/* Список диалогов */}
          <div
            className={`${
              activeId ? "hidden md:flex" : "flex"
            } flex-col w-full md:w-80 shrink-0 md:border-r dark:border-gray-700`}
          >
            <h1 className="px-4 py-3 text-sm font-semibold border-b dark:border-gray-700 dark:text-gray-100">
              Сообщения
            </h1>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="text-gray-500 dark:text-gray-400 text-center text-sm py-8">Загрузка...</p>
              ) : conversations.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center text-sm py-8 px-4">
                  Пока нет диалогов. Откройте профиль пользователя и нажмите «Написать».
                </p>
              ) : (
                conversations.map((c) => {
                  const mine = c.lastMessage.senderId === user?.id;
                  return (
                    <Link
                      key={c.id}
                      to={`/messages/${c.id}`}
                      state={{ otherUser: c.otherUser }}
                      className={`flex items-center gap-3 px-4 py-3 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        c.id === activeId ? "bg-gray-50 dark:bg-gray-700" : ""
                      }`}
                    >
                      <Avatar
                        username={c.otherUser.username}
                        displayName={c.otherUser.displayName}
                        avatarColor={c.otherUser.avatarColor}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate dark:text-gray-100">
                            {c.otherUser.displayName || c.otherUser.username}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                            {formatListDate(c.lastMessage.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {mine ? "Вы: " : ""}
                            {c.lastMessage.content}
                          </span>
                          {c.unreadCount > 0 && c.id !== activeId && (
                            <span className="bg-blue-600 text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center shrink-0">
                              {c.unreadCount > 99 ? "99+" : c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* Переписка */}
          <div className={`${activeId ? "flex" : "hidden md:flex"} flex-col flex-1 min-w-0`}>
            {activeId && user ? (
              <Thread
                key={activeId}
                conversationId={activeId}
                conversations={conversations}
                otherUser={activeUser}
                myId={user.id}
                onChanged={loadConversations}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                Выберите диалог
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}