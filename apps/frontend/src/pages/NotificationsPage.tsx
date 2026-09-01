import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Heart, MessageCircle, UserPlus, Trash2 } from "lucide-react";
import {
  fetchNotifications,
  markNotificationsRead,
  deleteNotification,
  type Notification,
} from "../lib/notifications";
import { AppLayout } from "../components/AppLayout";

const POLL_INTERVAL_MS = 10000;

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
};

const LABELS = {
  like: "лайкнул(а) ваш пост",
  comment: "прокомментировал(а) ваш пост",
  follow: "подписался(ась) на вас",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async (markRead: boolean) => {
      const data = await fetchNotifications();
      if (cancelled) return;
      setNotifications(data.notifications);
      if (markRead && data.unreadCount > 0) markNotificationsRead();
    };

    load(true).finally(() => setLoading(false));

    const interval = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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
      <div className="max-w-2xl mx-auto p-8 space-y-3">
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
                <Link to={`/u/${n.actor.username}`} className="flex-1 text-sm hover:underline dark:text-gray-200">
                  <span className="font-medium">{n.actor.displayName || n.actor.username}</span>{" "}
                  {LABELS[n.type]}
                </Link>
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