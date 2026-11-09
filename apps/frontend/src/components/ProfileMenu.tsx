import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Settings, Bookmark, LogOut, Mail, Shield } from "lucide-react";
import { isStaff } from "../auth/roles";
import { useAuth } from "../auth/AuthContext";
import { fetchConversations, MESSAGES_CHANGED_EVENT } from "../lib/messages";
import { Avatar } from "./Avatar";
import { coalesce } from "../lib/coalesce";
import { useRealtime } from "../lib/useRealtime";

const UNREAD_FALLBACK_POLL_MS = 60000;
// Только эти события меняют счётчик непрочитанных
const UNREAD_EVENTS = new Set([
  "message.new",
  "message.deleted",
  "conversation.read",
  "conversation.deleted",
]);

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const loadRef = useRef<() => void>(() => {});
  const refresh = useMemo(() => coalesce(() => loadRef.current(), 150), []);
  useEffect(() => () => refresh.cancel(), [refresh]);

  const { connected } = useRealtime(user?.id, {
    onEvent: (e) => {
      if (UNREAD_EVENTS.has(e.type)) refresh();
    },
    onCatchUp: () => loadRef.current(),
  });

  useEffect(() => {
    if (!user) return;
    const load = () =>
      fetchConversations()
        .then((data) =>
          setMessagesUnread(data.conversations.reduce((sum, c) => sum + c.unreadCount, 0)),
        )
        .catch(() => {});
    loadRef.current = load;
    load();
    window.addEventListener(MESSAGES_CHANGED_EVENT, load);
    return () => {
      loadRef.current = () => {};
      window.removeEventListener(MESSAGES_CHANGED_EVENT, load);
    };
  }, [user]);

  // Пока SSE не подключён, бейдж обновляется редким опросом
  useEffect(() => {
    if (!user || connected) return;
    const interval = setInterval(() => loadRef.current(), UNREAD_FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [user, connected]);

  if (!user) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center"
        aria-label="Меню профиля"
      >
        <Avatar username={user.username} avatarColor={user.avatarColor} size="sm" />
        {messagesUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50 dark:border-gray-900" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 overflow-hidden z-20">
          <div className="flex items-center justify-between px-3 py-3 border-b dark:border-gray-700">
            <Link
              to={`/u/${user.username}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 text-sm font-medium hover:underline dark:text-gray-100"
            >
              <Avatar username={user.username} avatarColor={user.avatarColor} size="sm" />
              @{user.username}
            </Link>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Настройки"
            >
              <Settings size={18} />
            </Link>
          </div>

          <nav className="py-1">
            <Link
              to="/messages"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Mail size={16} />
              Сообщения
              {messagesUnread > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                  {messagesUnread > 99 ? "99+" : messagesUnread}
                </span>
              )}
            </Link>
            <Link
              to="/bookmarks"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Bookmark size={16} />
              Закладки
            </Link>
            {isStaff(user) && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Shield size={16} />
                Админка
              </Link>
            )}
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
            >
              <LogOut size={16} />
              Выход
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}