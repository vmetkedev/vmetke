import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { fetchPost, type Post } from "../lib/posts";
import { PostCard } from "../components/PostCard";

export default function PostPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    fetchPost(postId)
      .then(setPost)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) return <p className="p-8 text-center text-gray-500">Загрузка...</p>;
  if (error || !post) return <p className="p-8 text-center text-red-600">{error || "Пост не найден"}</p>;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PostCard post={post} linkTitle={false} onDeleted={() => navigate("/")} />
    </div>
  );
}