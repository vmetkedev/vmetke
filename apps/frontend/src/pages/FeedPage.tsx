import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Bell, SquarePen } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { fetchFeed, type Post } from "../lib/posts";
import { fetchNotifications } from "../lib/notifications";
import { PostCard } from "../components/PostCard";
import { SearchDropdown } from "../components/SearchDropdown";

export default function FeedPage() {
  const { user, logout } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFeed();
      setPosts(data.posts);
      setCursor(data.nextCursor);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const load = () => fetchNotifications().then((data) => setUnreadCount(data.unreadCount));
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const data = await fetchFeed(cursor);
      setPosts((prev) => [...prev, ...data.posts]);
      setCursor(data.nextCursor);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Привет, {user?.username}</h1>
        <div className="flex items-center gap-4">
          <SearchDropdown />
          <Link to="/notifications" className="relative flex items-center text-gray-600">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <Link to="/new-post" className="flex items-center text-gray-600 hover:text-gray-800">
            <SquarePen size={20} />
          </Link>
          <button onClick={logout} className="text-sm text-gray-500">
            Выйти
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? (
        <p className="text-gray-500 text-center py-8">Загрузка...</p>
      ) : posts.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Пока пусто. Напишите первый пост!</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))} />
          ))}
        </div>
      )}

      {cursor && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full text-sm text-blue-600 py-2 disabled:opacity-50"
        >
          {loadingMore ? "Загрузка..." : "Показать ещё"}
        </button>
      )}
    </div>
  );
}