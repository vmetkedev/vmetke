import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Bell, Search, SquarePen } from "lucide-react";
import { useAuth } from "@/entities/session";
import { coalesce } from "@/shared/lib/coalesce";
import { fetchNotifications, NOTIFICATIONS_CHANGED_EVENT } from "@/entities/notification";
import { useRealtime } from "@/shared/api/useRealtime";
import { ProfileMenu } from "./ProfileMenu";

// Пока SSE не подключён, счётчик обновляется редким опросом
const FALLBACK_POLL_MS = 30000;
export function AppHeader() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadRef = useRef<() => void>(() => {});
  const seq = useRef({ started: 0, applied: 0 });
  const refresh = useMemo(() => coalesce(() => loadRef.current(), 150), []);
  useEffect(() => () => refresh.cancel(), [refresh]);

  const { connected } = useRealtime(user?.id, {
    onEvent: (e) => {
      if (e.type.startsWith("notification.")) refresh();
    },
    onCatchUp: () => loadRef.current(),
  });

  useEffect(() => {
    if (!user) return;
    const load = () => {
      const n = ++seq.current.started;
      fetchNotifications()
        .then((data) => {
          // ответ старее уже применённого не должен откатывать счётчик
          if (n < seq.current.applied) return;
          seq.current.applied = n;
          setUnreadCount(data.unreadCount);
        })
        .catch(() => {});
    };
    loadRef.current = load;
    load();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
    return () => {
      loadRef.current = () => {};
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
    };
  }, [user]);

  useEffect(() => {
    if (!user || connected) return;
    const interval = setInterval(() => loadRef.current(), FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [user, connected]);

  if (!user) {
    return (
      <header className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-8 py-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-semibold text-blue-600 dark:text-blue-400">
            Vmetke
          </Link>
          <Link to="/login" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Вход
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
      <div className="max-w-5xl mx-auto px-8 py-4 flex justify-between items-center">
        <Link to="/" className="text-xl font-semibold text-blue-600 dark:text-blue-400">
          Vmetke
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/search" className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <Search size={20} />
          </Link>
          <Link to="/notifications" className="relative flex items-center text-gray-600 dark:text-gray-300">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <Link to="/new-post" className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <SquarePen size={20} />
          </Link>
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}