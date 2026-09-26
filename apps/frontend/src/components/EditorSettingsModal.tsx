import { useState } from "react";

type EditorSettingsModalProps = {
  currentMode: "wysiwyg" | "markdown";
  onSave: (mode: "wysiwyg" | "markdown") => void;
  onClose: () => void;
};

function HelpIcon({ href, title }: { href: string; title: string }) {
  return <a href={href} target="_blank" rel="noreferrer" onClick={(e: React.MouseEvent) => e.stopPropagation()} title={title} className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-400 dark:border-gray-500 text-gray-400 dark:text-gray-500 hover:border-gray-600 hover:text-gray-600 dark:hover:border-gray-300 dark:hover:text-gray-300 text-[10px] leading-none">?</a>;
}

export function EditorSettingsModal({ currentMode, onSave, onClose }: EditorSettingsModalProps) {
  const [selected, setSelected] = useState(currentMode);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-sm space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold dark:text-gray-100">Настройки редактора</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Для написания публикаций и постов вы можете выбрать один из редакторов
        </p>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm dark:text-gray-200 cursor-pointer">
            <input
              type="radio"
              name="editor-mode"
              checked={selected === "wysiwyg"}
              onChange={() => setSelected("wysiwyg")}
              className="w-4 h-4 accent-blue-600"
            />
            WYSIWYG
            <HelpIcon href="/docs/help/wysiwyg" title="Справка по редактору WYSIWYG" />
          </label>

          <label className="flex items-center gap-2 text-sm dark:text-gray-200 cursor-pointer">
            <input
              type="radio"
              name="editor-mode"
              checked={selected === "markdown"}
              onChange={() => setSelected("markdown")}
              className="w-4 h-4 accent-blue-600"
            />
            Markdown
            <HelpIcon href="/docs/help/markdown" title="Справка по разметке Markdown" />
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              onSave(selected);
              onClose();
            }}
            className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm"
          >
            Сохранить
          </button>
          <button
            onClick={onClose}
            className="border border-gray-300 dark:border-gray-600 dark:text-gray-200 rounded px-4 py-1.5 text-sm"
          >
            Отменить
          </button>
        </div>
      </div>
    </div>
  );
}