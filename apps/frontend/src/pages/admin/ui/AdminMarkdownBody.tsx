import { useMarkdownHtml } from "@/shared/lib/useMarkdownHtml";

export function AdminMarkdownBody({ content, className = "" }: { content: string; className?: string }) {
  const html = useMarkdownHtml(content);
  return (
    <div
      className={`post-content break-words dark:text-gray-100 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}