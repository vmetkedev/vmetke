import { Bold, Italic, Heading2, Quote, Code, Link2, List, ListOrdered } from "lucide-react";
import type { RefObject } from "react";

type Wrap = { before: string; after: string; placeholder: string };
type LinePrefix = { prefix: string; placeholder: string };

const WRAP_ACTIONS: Record<string, Wrap> = {
  bold: { before: "**", after: "**", placeholder: "жирный текст" },
  italic: { before: "*", after: "*", placeholder: "курсив" },
  code: { before: "`", after: "`", placeholder: "код" },
};

const LINE_ACTIONS: Record<string, LinePrefix> = {
  heading: { prefix: "## ", placeholder: "Заголовок" },
  quote: { prefix: "> ", placeholder: "цитата" },
  ul: { prefix: "- ", placeholder: "пункт списка" },
  ol: { prefix: "1. ", placeholder: "пункт списка" },
};

export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}) {
  const applyWrap = (key: keyof typeof WRAP_ACTIONS) => {
    const el = textareaRef.current;
    if (!el) return;
    const { before, after, placeholder } = WRAP_ACTIONS[key];
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const applyLinePrefix = (key: keyof typeof LINE_ACTIONS) => {
    const el = textareaRef.current;
    if (!el) return;
    const { prefix, placeholder } = LINE_ACTIONS[key];
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const selectedLine = value.slice(lineStart, end).trim() || placeholder;
    const next = value.slice(0, lineStart) + prefix + selectedLine + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = lineStart + prefix.length + selectedLine.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const applyLink = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "текст ссылки";
    const insert = `[${selected}](https://)`;
    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const urlStart = start + selected.length + 3;
      el.setSelectionRange(urlStart, urlStart + 8);
    });
  };

  const buttons = [
    { icon: <Bold size={16} />, label: "Жирный", onClick: () => applyWrap("bold") },
    { icon: <Italic size={16} />, label: "Курсив", onClick: () => applyWrap("italic") },
    { icon: <Heading2 size={16} />, label: "Заголовок", onClick: () => applyLinePrefix("heading") },
    { icon: <Quote size={16} />, label: "Цитата", onClick: () => applyLinePrefix("quote") },
    { icon: <Code size={16} />, label: "Код", onClick: () => applyWrap("code") },
    { icon: <Link2 size={16} />, label: "Ссылка", onClick: applyLink },
    { icon: <List size={16} />, label: "Список", onClick: () => applyLinePrefix("ul") },
    { icon: <ListOrdered size={16} />, label: "Нумерованный список", onClick: () => applyLinePrefix("ol") },
  ];

  return (
    <div className="flex items-center gap-1 border dark:border-gray-600 border-b-0 rounded-t px-2 py-1.5 bg-gray-50 dark:bg-gray-700">
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          onClick={b.onClick}
          aria-label={b.label}
          title={b.label}
          className="p-1.5 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          {b.icon}
        </button>
      ))}
    </div>
  );
}