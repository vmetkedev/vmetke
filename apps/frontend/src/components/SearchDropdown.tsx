import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Search, X } from "lucide-react";
import { search, type UserSearchResult, type PostSearchResult } from "../lib/search";

export function SearchDropdown() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"users" | "posts">("users");
  const [query, setQuery] = useState("");
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [postResults, setPostResults] = useState<PostSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setUserResults([]);
      setPostResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await search(query.trim(), type);
        if (type === "users") setUserResults(results as UserSearchResult[]);
        else setPostResults(results as PostSearchResult[]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, type]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeAndReset = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative flex items-center" ref={containerRef}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center text-gray-600 hover:text-gray-800">
        <Search size={20} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск..."
              className="flex-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded px-2 py-1.5 text-sm"
            />
            <button onClick={closeAndReset} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={16} />
            </button>
          </div>

          <div className="flex gap-2 mb-2 text-xs">
            <button
              onClick={() => setType("users")}
              className={`px-2 py-1 rounded ${
                type === "users"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              }`}
            >
              Пользователи
            </button>
            <button
              onClick={() => setType("posts")}
              className={`px-2 py-1 rounded ${
                type === "posts"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              }`}
            >
              Посты
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1">
            {loading && <p className="text-xs text-gray-400 dark:text-gray-500 py-2 text-center">Поиск...</p>}

            {!loading && type === "users" &&
              userResults.map((u) => (
                <Link
                  key={u.id}
                  to={`/u/${u.username}`}
                  onClick={closeAndReset}
                  className="block px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  <span className="font-medium dark:text-gray-100">{u.displayName || u.username}</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-1.5">@{u.username}</span>
                </Link>
              ))}

            {!loading && type === "posts" &&
              postResults.map((p) => (
                <Link
                  key={p.id}
                  to={`/post/${p.id}`}
                  onClick={closeAndReset}
                  className="block px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  <div className="font-medium truncate dark:text-gray-100">{p.title || "Без названия"}</div>
                  <div className="text-gray-400 dark:text-gray-500 text-xs truncate">{p.content}</div>
                </Link>
              ))}

            {!loading &&
              query.trim() &&
              ((type === "users" && userResults.length === 0) ||
                (type === "posts" && postResults.length === 0)) && (
                <p className="text-xs text-gray-400 dark:text-gray-500 py-2 text-center">Ничего не найдено</p>
              )}
          </div>
        </div>
      )}
    </div>
  );
}