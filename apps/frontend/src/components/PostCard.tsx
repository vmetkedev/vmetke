import { Link } from "react-router";
import type { Post } from "../lib/posts";

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PostCard({ post }: { post: Post }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex items-center justify-between mb-1.5">
        <Link to={`/u/${post.author.username}`} className="font-medium text-sm hover:underline">
          {post.author.displayName || post.author.username}
        </Link>
        <span className="text-xs text-gray-400">{formatDate(post.createdAt)}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap wrap-break-word">{post.content}</p>
    </div>
  );
}