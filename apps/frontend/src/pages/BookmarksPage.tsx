import { useCallback, useEffect, useState } from "react";
import { fetchBookmarks, type Post } from "../lib/posts";
import { PostCard } from "../components/PostCard";
import { AppLayout } from "../components/AppLayout";

export default function BookmarksPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBookmarks();
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

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const data = await fetchBookmarks(cursor);
      setPosts((prev) => [...prev, ...data.posts]);
      setCursor(data.nextCursor);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-8 space-y-4">
        <h1 className="text-xl font-semibold dark:text-gray-100">Избранное</h1>

        {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">Загрузка...</p>
        ) : posts.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Пока ничего не добавлено в избранное.
          </p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
              />
            ))}
          </div>
        )}

        {cursor && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full text-sm text-blue-600 dark:text-blue-400 py-2 disabled:opacity-50"
          >
            {loadingMore ? "Загрузка..." : "Показать ещё"}
          </button>
        )}
      </div>
    </AppLayout>
  );
}