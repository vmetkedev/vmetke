import { useState } from "react";
import { Link } from "react-router";
import { Heart, MessageCircle } from "lucide-react";
import {
  type Post,
  type Comment,
  likePost,
  unlikePost,
  fetchComments,
  createComment,
} from "../lib/posts";

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PostCard({ post: initialPost }: { post: Post }) {
  const [post, setPost] = useState(initialPost);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const toggleLike = async () => {
    setLikeLoading(true);
    const wasLiked = post.isLikedByMe;
    setPost((p) => ({
      ...p,
      isLikedByMe: !wasLiked,
      likesCount: p.likesCount + (wasLiked ? -1 : 1),
    }));
    try {
      if (wasLiked) {
        await unlikePost(post.id);
      } else {
        await likePost(post.id);
      }
    } catch {
      setPost((p) => ({
        ...p,
        isLikedByMe: wasLiked,
        likesCount: p.likesCount + (wasLiked ? 1 : -1),
      }));
    } finally {
      setLikeLoading(false);
    }
  };

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) {
      setCommentsLoading(true);
      try {
        const data = await fetchComments(post.id);
        setComments(data);
      } finally {
        setCommentsLoading(false);
      }
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setCommentSubmitting(true);
    try {
      const comment = await createComment(post.id, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      setPost((p) => ({ ...p, commentsCount: p.commentsCount + 1 }));
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex items-center justify-between mb-1.5">
        <Link to={`/u/${post.author.username}`} className="font-medium text-sm hover:underline">
          {post.author.displayName || post.author.username}
        </Link>
        <span className="text-xs text-gray-400">{formatDate(post.createdAt)}</span>
      </div>

      <p className="text-sm whitespace-pre-wrap wrap-break-word">{post.content}</p>

      <div className="flex items-center gap-4 mt-3 pt-2 border-t">
        <button
          onClick={toggleLike}
          disabled={likeLoading}
          className={`flex items-center gap-1 text-sm ${
            post.isLikedByMe ? "text-red-500" : "text-gray-500"
          } disabled:opacity-50`}
        >
          <Heart size={16} fill={post.isLikedByMe ? "currentColor" : "none"} />
          {post.likesCount}
        </button>

        <button onClick={toggleComments} className="flex items-center gap-1 text-sm text-gray-500">
          <MessageCircle size={16} />
          {post.commentsCount}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 pt-3 border-t space-y-2">
          {commentsLoading ? (
            <p className="text-xs text-gray-400">Загрузка...</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="text-sm">
                <Link to={`/u/${c.author.username}`} className="font-medium hover:underline">
                  {c.author.displayName || c.author.username}
                </Link>
                <span className="text-gray-700 ml-1.5">{c.content}</span>
              </div>
            ))
          )}
          <form onSubmit={handleCommentSubmit} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Написать комментарий..."
              className="flex-1 border rounded px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={commentSubmitting || !newComment.trim()}
              className="text-sm text-blue-600 disabled:opacity-50"
            >
              Отправить
            </button>
          </form>
        </div>
      )}
    </div>
  );
}