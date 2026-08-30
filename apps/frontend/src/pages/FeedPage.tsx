import { useCallback, useEffect, useState } from "react";
import { fetchFeed, type Post } from "../lib/posts";
import { PostCard } from "../components/PostCard";
import { AppLayout } from "../components/AppLayout";

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <AppLayout>
      <div className="max-w-2xl mx-auto p-8 space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {loading ? (
          <p className="text-gray-500 text-center py-8">Загрузка...</p>
        ) : posts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Пока пусто. Напишите первый пост!</p>
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
            className="w-full text-sm text-blue-600 py-2 disabled:opacity-50"
          >
            {loadingMore ? "Загрузка..." : "Показать ещё"}
          </button>
        )}
      </div>
    </AppLayout>
  );
}