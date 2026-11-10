import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { coalesce } from "../lib/coalesce";
import { useRealtime } from "../lib/useRealtime";
import { Link } from "react-router";
import { Heart, MessageCircle, UserPlus, Trash2, ShieldAlert } from "lucide-react";
import {
  fetchNotifications,
  markNotificationsRead,
  deleteNotification,
  type Notification,
} from "../lib/notifications";
import { AppLayout } from "../components/AppLayout";

// Пока SSE не подключён, список обновляется редким опросом
const FALLBACK_POLL_MS = 30000;

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ICONS = {
  like: <Heart size={16} className="text-red-500" />,
  comment: <MessageCircle size={16} className="text-blue-500" />,
  follow: <UserPlus size={16} className="text-green-600" />,
  moderation: <ShieldAlert size={16} className="text-amber-500" />,
};

const LABELS = {
  like: "лайкнул(а) ваш пост",
  comment: "прокомментировал(а) ваш пост",
  follow: "подписался(ась) на вас",
};

function moderationText(n: Notification) {
  const d = n.details;
  if (d?.action === "comment_deleted") {
    return `Ваш комментарий${d.title ? ` «${d.title}»` : ""} удалён модератором.`;
  }
  return `Ваш пост «${d?.title || "без названия"}» удалён модератором.`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const loadRef = useRef<(markRead: boolean) => Promise<void>>(async () => {});
  const seq = useRef({ started: 0, applied: 0 });

  useEffect(() => {
    let cancelled = false;

    const load = async (markRead: boolean) => {
      const n = ++seq.current.started;
      try {
        const data = await fetchNotifications();
        // ответ старее уже применённого не должен откатывать список
        if (cancelled || n < seq.current.applied) return;
        seq.current.applied = n;
        setNotifications(data.notifications);
        if (markRead && data.unreadCount > 0) markNotificationsRead().catch(() => {});
      } catch {
        // следующее событие или опрос попробует снова
      }
    };

    loadRef.current = load;
    load(true).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      loadRef.current = async () => {};
    };
  }, []);

  const refresh = useMemo(() => coalesce(() => void loadRef.current(false), 150), []);
  useEffect(() => () => refresh.cancel(), [refresh]);

  const { connected } = useRealtime(user?.id, {
    onEvent: (e) => {
      if (e.type.startsWith("notification.")) refresh();
    },
    onCatchUp: () => void loadRef.current(false),
  });

  useEffect(() => {
    if (connected) return;
    const interval = setInterval(() => void loadRef.current(false), FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [connected]);

  const handleDelete = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteNotification(id);
    } catch {
      // при ошибке просто оставляем как есть — следующий poll вернёт актуальный список
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-8 space-y-3">
        <h1 className="text-xl font-semibold dark:text-gray-100">Уведомления</h1>
        {loading ? (
          <p className="text-gray-500 text-center py-8">Загрузка...</p>
        ) : notifications.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">Пока нет уведомлений.</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-center gap-3 p-3 rounded-lg shadow-sm group ${
                  n.read ? "bg-white dark:bg-gray-800" : "bg-blue-50 dark:bg-blue-950"
                }`}
              >
                {ICONS[n.type]}
                {n.type === "moderation" ? (
                  <div className="flex-1 text-sm dark:text-gray-200 min-w-0">
                    <p className="break-words">{moderationText(n)}</p>
                    {n.details?.reason && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 break-words">
                        Причина: {n.details.reason}
                      </p>
                    )}
                  </div>
                ) : n.actor ? (
                  <Link to={`/u/${n.actor.username}`} className="flex-1 text-sm hover:underline dark:text-gray-200">
                    <span className="font-medium">{n.actor.displayName || n.actor.username}</span>{" "}
                    {LABELS[n.type]}
                  </Link>
                ) : (
                  <span className="flex-1 text-sm dark:text-gray-200">{LABELS[n.type]}</span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{formatDate(n.createdAt)}</span>
                <button
                  onClick={() => handleDelete(n.id)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0"
                  aria-label="Удалить уведомление"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}