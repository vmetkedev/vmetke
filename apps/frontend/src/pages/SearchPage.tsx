import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { search, type UserSearchResult, type PostSearchResult } from "../lib/search";
import { searchPostsByTag } from "../lib/search";
import { AppLayout } from "../components/AppLayout";
import { Avatar } from "../components/Avatar";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const tag = searchParams.get("tag") ?? "";

  const [type, setType] = useState<"users" | "posts">("posts");
  const [query, setQuery] = useState("");
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [postResults, setPostResults] = useState<PostSearchResult[]>([]);
  const [tagResults, setTagResults] = useState<PostSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Поиск по тегу (переход по чипу "Теги:" на посте)
  useEffect(() => {
    if (!tag) {
      setTagResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    searchPostsByTag(tag)
      .then((res) => {
        if (!cancelled) setTagResults(res);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tag]);

  // Обычный поиск по запросу (когда тег не выбран)
  useEffect(() => {
    if (tag) return;
    if (!query.trim()) {
      setUserResults([]);
      setPostResults([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await search(query.trim(), type);
        if (cancelled) return;
        if (type === "users") setUserResults(results as UserSearchResult[]);
        else setPostResults(results as PostSearchResult[]);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, type, tag]);

  if (tag) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto p-8 space-y-4">
          <h1 className="text-xl font-semibold dark:text-gray-100">
            Посты с тегом <span className="text-blue-600 dark:text-blue-400">{tag}</span>
          </h1>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка...</p>}
          {!loading && !error && tagResults.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Постов с таким тегом пока нет</p>
          )}

          <div className="space-y-2">
            {tagResults.map((p) => (
              <Link
                key={p.id}
                to={`/post/${p.id}`}
                className="block bg-white dark:bg-gray-800 p-4 rounded-lg shadow hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="font-bold text-lg dark:text-gray-100">{p.title || "Без названия"}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{p.content}</div>
              </Link>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-8 space-y-4">
        <h1 className="text-xl font-semibold dark:text-gray-100">Поиск</h1>

        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск..."
          className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2 text-sm"
        />

        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setType("users")}
            className={`px-3 py-1.5 rounded ${
              type === "users"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
            }`}
          >
            Пользователи
          </button>
          <button
            onClick={() => setType("posts")}
            className={`px-3 py-1.5 rounded ${
              type === "posts"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
            }`}
          >
            Посты
          </button>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Поиск...</p>}

        <div className="space-y-2">
          {!loading &&
            type === "users" &&
            userResults.map((u) => (
              <Link
                key={u.id}
                to={`/u/${u.username}`}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 p-3 rounded-lg shadow hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Avatar username={u.username} displayName={u.displayName} size="sm" />
                <div>
                  <div className="font-medium dark:text-gray-100">{u.displayName || u.username}</div>
                  <div className="text-gray-400 dark:text-gray-500 text-xs">@{u.username}</div>
                </div>
              </Link>
            ))}

          {!loading &&
            type === "posts" &&
            postResults.map((p) => (
              <Link
                key={p.id}
                to={`/post/${p.id}`}
                className="block bg-white dark:bg-gray-800 p-4 rounded-lg shadow hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="font-bold text-lg dark:text-gray-100">{p.title || "Без названия"}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{p.content}</div>
              </Link>
            ))}

          {!loading &&
            query.trim() &&
            ((type === "users" && userResults.length === 0) ||
              (type === "posts" && postResults.length === 0)) && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Ничего не найдено</p>
            )}
        </div>
      </div>
    </AppLayout>
  );
}