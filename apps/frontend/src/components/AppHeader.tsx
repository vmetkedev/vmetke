import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Bell, SquarePen, Bookmark } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { fetchNotifications } from "../lib/notifications";
import { SearchDropdown } from "./SearchDropdown";

export function AppHeader() {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = () => fetchNotifications().then((data) => setUnreadCount(data.unreadCount));
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) {
    return (
      <header className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-8 py-4 flex justify-between items-center">
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
      <div className="max-w-2xl mx-auto px-8 py-4 flex justify-between items-center">
        <Link to="/" className="text-xl font-semibold text-blue-600 dark:text-blue-400">
          Vmetke
        </Link>
        <div className="flex items-center gap-4">
          <SearchDropdown />
          <Link to="/notifications" className="relative flex items-center text-gray-600 dark:text-gray-300">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <Link to="/bookmarks" className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <Bookmark size={20} />
          </Link>
          <Link to="/new-post" className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <SquarePen size={20} />
          </Link>
          <button onClick={logout} className="text-sm text-gray-500 dark:text-gray-400">
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}