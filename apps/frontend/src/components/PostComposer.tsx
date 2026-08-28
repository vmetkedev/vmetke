import { useState } from "react";
import { createPost } from "../lib/posts";

const MAX_LENGTH = 2000;

export function PostComposer({ onPosted }: { onPosted: (content: string) => void }) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const post = await createPost(content.trim());
      setContent("");
      onPosted(post.content);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow space-y-2">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Что нового?"
        maxLength={MAX_LENGTH}
        rows={3}
        className="w-full border rounded px-3 py-2 resize-none"
      />
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">
          {content.length}/{MAX_LENGTH}
        </span>
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm disabled:opacity-50"
        >
          {submitting ? "Публикация..." : "Опубликовать"}
        </button>
      </div>
    </form>
  );
}