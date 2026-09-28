import { useState, type KeyboardEvent } from "react";

export const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 30;

type TagInputProps = {
  value: string[];
  onChange: (tags: string[]) => void;
};

export function TagInput({ value, onChange }: TagInputProps) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (!tag || value.includes(tag) || value.length >= MAX_TAGS) return;
    onChange([...value, tag]);
  };

  const commit = () => {
    add(draft);
    setDraft("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-sm text-gray-700 dark:text-gray-200"
        >
          {tag}
          <button
            type="button"
            aria-label={`Удалить тег ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-100"
          >
            ×
          </button>
        </span>
      ))}
      {value.length < MAX_TAGS && (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(",", ""))}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          maxLength={MAX_TAG_LENGTH}
          placeholder={value.length === 0 ? "Теги (до 5): введите и нажмите Enter" : "Ещё тег"}
          className="min-w-40 flex-1 bg-transparent text-sm dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
        />
      )}
    </div>
  );
}