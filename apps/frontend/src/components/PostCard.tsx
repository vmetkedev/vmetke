import { useState } from "react";
import { Link } from "react-router";
import { Heart, MessageCircle, Pencil, Trash2, Check, X } from "lucide-react";
import {
  type Post,
  type Comment,
  likePost,
  unlikePost,
  fetchComments,
  createComment,
  updatePost,
  deletePost,
  deleteComment,
} from "../lib/posts";
import { useAuth } from "../auth/AuthContext";

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PostCard({
  post: initialPost,
  onDeleted,
}: {
  post: Post;
  onDeleted?: (postId: string) => void;
}) {
  const { user } = useAuth();
  const [post, setPost] = useState(initialPost);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);

  const isOwnPost = user?.id === post.author.id;

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

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setPost((p) => ({ ...p, commentsCount: p.commentsCount - 1 }));
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const updated = await updatePost(post.id, editContent.trim());
      setPost(updated as Post);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePost = async () => {
    if (!confirm("Удалить пост?")) return;
    await deletePost(post.id);
    onDeleted?.(post.id);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex items-center justify-between mb-1.5">
        <Link to={`/u/${post.author.username}`} className="font-medium text-sm hover:underline">
          {post.author.displayName || post.author.username}
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{formatDate(post.createdAt)}</span>
          {isOwnPost && !isEditing && (
            <>
              <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-gray-600">
                <Pencil size={14} />
              </button>
              <button onClick={handleDeletePost} className="text-gray-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full border rounded px-2 py-1.5 text-sm resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditContent(post.content);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={16} />
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="text-green-600 hover:text-green-700 disabled:opacity-50"
            >
              <Check size={16} />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap wrap-break-word">{post.content}</p>
      )}

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
              <div key={c.id} className="flex items-start justify-between text-sm group">
                <div>
                  <Link to={`/u/${c.author.username}`} className="font-medium hover:underline">
                    {c.author.displayName || c.author.username}
                  </Link>
                  <span className="text-gray-700 ml-1.5">{c.content}</span>
                </div>
                {user?.id === c.author.id && (
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 ml-2 shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
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