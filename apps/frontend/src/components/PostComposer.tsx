import { useState } from "react";
import { createPost } from "../lib/posts";

const MAX_TITLE = 200;
const MAX_CONTENT = 30000;

export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

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
    <form onSubmit={handleSubmit} className="system-dark:text-gray-100 p-4 rounded-lg shadow space-y-2">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Заголовок"
        maxLength={MAX_TITLE}
        className="w-full border rounded px-3 py-2 text-sm font-medium"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Что нового?"
        maxLength={MAX_CONTENT}
        rows={20}
        className="w-full border rounded px-3 py-2 resize-y text-sm"
      />
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">
          {content.length}/{MAX_CONTENT}
        </span>
        <button
          type="submit"
          disabled={submitting || !title.trim() || !content.trim()}
          className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm disabled:opacity-50"
        >
          {submitting ? "Публикация..." : "Опубликовать"}
        </button>
      </div>
    </form>
  );
}