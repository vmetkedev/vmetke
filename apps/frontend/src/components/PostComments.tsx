import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Trash2 } from "lucide-react";
import { fetchComments, createComment, deleteComment, type Comment } from "../lib/posts";
import { useAuth } from "../auth/AuthContext";

export function PostComments({
  postId,
  onCountChange,
}: {
  postId: string;
  onCountChange?: (delta: number) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchComments(postId)
      .then(setComments)
      .finally(() => setLoading(false));
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return navigate("/login");
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const comment = await createComment(postId, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      onCountChange?.(1);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    onCountChange?.(-1);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-3">
      <h3 className="text-sm font-medium dark:text-gray-100">Комментарии</h3>
        {loading ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">Загрузка...</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">Пока нет комментариев.</p>
        ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between text-sm group">
              <div>
                <Link to={`/u/${c.author.username}`} className="font-medium hover:underline dark:text-gray-100">
                  {c.author.displayName || c.author.username}
                </Link>
                <span className="text-gray-700 dark:text-gray-300 ml-1.5">{c.content}</span>
              </div>
              {user?.id === c.author.id && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 ml-2 shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Написать комментарий..."
          className="flex-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded px-2 py-1.5 text-sm mt-2"
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="text-sm text-blue-600 dark:text-blue-400 disabled:opacity-50 mt-2"
        >
          Отправить
        </button>
      </form>
    </div>
  );
}