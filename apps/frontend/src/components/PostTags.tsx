import { Link } from "react-router";

export function PostTags({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-gray-500 dark:text-gray-400">Теги:</span>
      {tags.map((tag) => (
        <Link
          key={tag}
          to={`/search?tag=${encodeURIComponent(tag)}`}
          className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          {tag}
        </Link>
      ))}
    </div>
  );
}