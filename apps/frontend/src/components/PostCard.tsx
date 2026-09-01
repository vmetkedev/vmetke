import { useState } from "react";
import { Link } from "react-router";
import { Heart, MessageCircle, Pencil, Trash2, Check, X, Clock, Eye, Bookmark } from "lucide-react";
import {
  type Post,
  likePost,
  unlikePost,
  updatePost,
  deletePost,
  bookmarkPost,
  unbookmarkPost,
} from "../lib/posts";
import { renderMarkdown } from "../lib/markdown";
import { estimateReadingMinutes } from "../lib/readingTime";
import { useAuth } from "../auth/AuthContext";

const PREVIEW_LENGTH = 500;

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
  linkTitle = true,
}: {
  post: Post;
  onDeleted?: (postId: string) => void;
  linkTitle?: boolean;
}) {
  const { user } = useAuth();
  const [post, setPost] = useState(initialPost);
  const [likeLoading, setLikeLoading] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title || "");
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);

  const isOwnPost = user?.id === post.author.id;
  const readingMinutes = estimateReadingMinutes(post.content);

  const toggleLike = async () => {
    setLikeLoading(true);
    const wasLiked = post.isLikedByMe;
    setPost((p) => ({ ...p, isLikedByMe: !wasLiked, likesCount: p.likesCount + (wasLiked ? -1 : 1) }));
    try {
      if (wasLiked) await unlikePost(post.id);
      else await likePost(post.id);
    } catch {
      setPost((p) => ({ ...p, isLikedByMe: wasLiked, likesCount: p.likesCount + (wasLiked ? 1 : -1) }));
    } finally {
      setLikeLoading(false);
    }
  };

  const toggleBookmark = async () => {
    setBookmarkLoading(true);
    const wasBookmarked = post.isBookmarkedByMe;
    setPost((p) => ({ ...p, isBookmarkedByMe: !wasBookmarked }));
    try {
      if (wasBookmarked) await unbookmarkPost(post.id);
      else await bookmarkPost(post.id);
    } catch {
      setPost((p) => ({ ...p, isBookmarkedByMe: wasBookmarked }));
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    setSaving(true);
    try {
      const updated = await updatePost(post.id, editTitle.trim(), editContent.trim());
      setPost(updated);
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
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <div className="flex items-center justify-between mb-1.5">
        <Link to={`/u/${post.author.username}`} className="font-medium text-sm hover:underline dark:text-gray-100">
          {post.author.displayName || post.author.username}
        </Link>
        <div className="flex items-center gap-2">
          {!linkTitle && <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(post.createdAt)}</span>}
          {!linkTitle && isOwnPost && !isEditing && (
            <>
              <button onClick={() => setIsEditing(true)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <Pencil size={14} />
              </button>
              <button onClick={handleDeletePost} className="text-gray-400 dark:text-gray-500 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded px-2 py-1.5 text-sm font-medium"
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={6}
            className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded px-2 py-1.5 text-sm resize-y"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditTitle(post.title || "");
                setEditContent(post.content);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={16} />
            </button>
            <button onClick={handleSaveEdit} disabled={saving} className="text-green-600 hover:text-green-700 disabled:opacity-50">
              <Check size={16} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {linkTitle ? (
            <Link to={`/post/${post.id}`} className="block font-bold text-lg mb-1 hover:underline dark:text-gray-100">
              {post.title || "Без названия"}
            </Link>
          ) : (
            <h2 className="font-bold text-xl mb-1 dark:text-gray-100">{post.title || "Без названия"}</h2>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-2">
            <span className="flex items-center gap-1">
              <Clock size={13} /> {readingMinutes} мин
            </span>
            <span className="flex items-center gap-1">
              <Eye size={13} /> {post.viewsCount}
            </span>
          </div>

          {(() => {
            const isTruncated = linkTitle && post.content.length > PREVIEW_LENGTH;
            const displayText = isTruncated ? `${post.content.slice(0, PREVIEW_LENGTH)}…` : post.content;
            return (
              <>
                <div
                  className="text-sm text-gray-700 dark:text-gray-300 [&_a]:wrap-break-word"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(displayText) }}
                />
                {isTruncated && (
                  <Link to={`/post/${post.id}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block">
                    Читать далее
                  </Link>
                )}
              </>
            );
          })()}
        </>
      )}

      <div className="flex items-center gap-4 mt-3 pt-2 border-t dark:border-gray-700">
        <button
          onClick={toggleLike}
          disabled={likeLoading}
          className={`flex items-center gap-1 text-sm ${post.isLikedByMe ? "text-red-500" : "text-gray-500 dark:text-gray-400"} disabled:opacity-50`}
        >
          <Heart size={16} fill={post.isLikedByMe ? "currentColor" : "none"} />
          {post.likesCount}
        </button>

        {linkTitle ? (
          <Link to={`/post/${post.id}`} className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <MessageCircle size={16} />
            {post.commentsCount}
          </Link>
        ) : (
          <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <MessageCircle size={16} />
            {post.commentsCount}
          </span>
        )}

        <button
          onClick={toggleBookmark}
          disabled={bookmarkLoading}
          className={`flex items-center gap-1 text-sm ${post.isBookmarkedByMe ? "text-yellow-500" : "text-gray-500 dark:text-gray-400"} disabled:opacity-50`}
          aria-label={post.isBookmarkedByMe ? "Убрать из избранного" : "Добавить в избранное"}
        >
          <Bookmark size={16} fill={post.isBookmarkedByMe ? "currentColor" : "none"} />
        </button>

        {linkTitle && <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{formatDate(post.createdAt)}</span>}
      </div>
    </div>
  );
}