import { useState } from "react";
import { createPost } from "../lib/posts";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "./Avatar";
import { BlockEditor } from "./editor/BlockEditor";

const MAX_TITLE = 200;
const MAX_CONTENT = 30000;

export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    if (content.length > MAX_CONTENT) {
      setError(`Максимум ${MAX_CONTENT} символов`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createPost(title.trim(), content.trim());
      setTitle("");
      setContent("");
      onPosted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {user && (
        <div className="flex items-center gap-2">
          <Avatar username={user.username} avatarColor={user.avatarColor} size="sm" />
          <span className="text-sm font-medium dark:text-gray-100">{user.username}</span>
          <span className="text-sm text-gray-400 dark:text-gray-500">Новый пост</span>
        </div>
      )}

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Заголовок"
        maxLength={MAX_TITLE}
        className="w-full bg-transparent text-3xl font-bold placeholder-gray-300 dark:placeholder-gray-600 dark:text-gray-100 focus:outline-none"
      />

      <BlockEditor content={content} onChange={setContent} />

      <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {content.length}/{MAX_CONTENT}
        </span>
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !content.trim()}
          className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm disabled:opacity-50"
        >
          {submitting ? "Публикация..." : "Опубликовать"}
        </button>
      </div>
    </div>
  );
}