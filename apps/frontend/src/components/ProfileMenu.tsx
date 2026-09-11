import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Settings, Bookmark, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "./Avatar";

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
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

  if (!user) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center" aria-label="Меню профиля">
        <Avatar username={user.username} avatarColor={user.avatarColor} size="sm" />
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
              to="/bookmarks"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Bookmark size={16} />
              Закладки
            </Link>
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