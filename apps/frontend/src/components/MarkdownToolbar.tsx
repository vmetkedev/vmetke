import type { RefObject } from "react";
import { ToolbarDropdown } from "./editor/ToolbarDropdown";
import {
  Type,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Eraser,
  Heading,
  Quote,
  List,
  ListOrdered,
  Image as ImageIcon,
  Table2,
  Minus,
  Code,
  Sigma,
  Superscript,
  EyeOff,
  Anchor as AnchorIcon,
  AtSign,
} from "lucide-react";

type Wrap = (selectedText: string) => { text: string; cursorOffset?: number };

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
    >
      <Icon size={18} />
    </button>
  );
}

function ToolbarTextButton({ text, label, onClick }: { text: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="px-2 py-1 rounded text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
    >
      {text}
    </button>
  );
}

type MarkdownToolbarProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  content: string;
  onChange: (value: string) => void;
};

export function MarkdownToolbar({ textareaRef, content, onChange }: MarkdownToolbarProps) {
  const apply = (wrap: Wrap) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? content.length;
    const end = textarea.selectionEnd ?? content.length;
    const selected = content.slice(start, end);

    const { text, cursorOffset } = wrap(selected);
    const newContent = content.slice(0, start) + text + content.slice(end);
    onChange(newContent);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + (cursorOffset ?? text.length);
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="flex items-center gap-1 flex-wrap border-t dark:border-gray-700 pt-2 mt-2">
      <ToolbarDropdown icon={Type} label="Текст">
        {(close) => (
          <>
            <ToolbarButton icon={Bold} label="Жирный" onClick={() => { apply((sel) => ({ text: `**${sel || "текст"}**` })); close(); }} />
            <ToolbarButton icon={Italic} label="Курсив" onClick={() => { apply((sel) => ({ text: `*${sel || "текст"}*` })); close(); }} />
            <ToolbarButton icon={UnderlineIcon} label="Подчёркнутый" onClick={() => { apply((sel) => ({ text: `<u>${sel || "текст"}</u>` })); close(); }} />
            <ToolbarButton icon={Strikethrough} label="Зачёркнутый" onClick={() => { apply((sel) => ({ text: `~~${sel || "текст"}~~` })); close(); }} />
            <ToolbarButton icon={SubscriptIcon} label="Подстрочный" onClick={() => { apply((sel) => ({ text: `<sub>${sel || "текст"}</sub>` })); close(); }} />
            <ToolbarButton icon={SuperscriptIcon} label="Надстрочный" onClick={() => { apply((sel) => ({ text: `<sup>${sel || "текст"}</sup>` })); close(); }} />
            <ToolbarButton icon={Eraser} label="Очистить форматирование" onClick={() => { apply((sel) => ({ text: sel.replace(/(\*\*|\*|~~|<\/?u>|<\/?sub>|<\/?sup>)/g, "") })); close(); }} />
          </>
        )}
      </ToolbarDropdown>

      <ToolbarDropdown icon={Heading} label="Заголовок">
        {(close) => (
          <>
            <ToolbarTextButton text="H1" label="Заголовок 1" onClick={() => { apply((sel) => ({ text: `# ${sel || "Заголовок"}` })); close(); }} />
            <ToolbarTextButton text="H2" label="Заголовок 2" onClick={() => { apply((sel) => ({ text: `## ${sel || "Заголовок"}` })); close(); }} />
            <ToolbarTextButton text="H3" label="Заголовок 3" onClick={() => { apply((sel) => ({ text: `### ${sel || "Заголовок"}` })); close(); }} />
          </>
        )}
      </ToolbarDropdown>


      <ToolbarButton icon={Quote} label="Цитата" onClick={() => apply((sel) => ({ text: `> ${sel || "цитата"}` }))} />

      <ToolbarDropdown icon={List} label="Список">
        {(close) => (
          <>
            <ToolbarButton icon={List} label="Маркированный список" onClick={() => { apply((sel) => ({ text: `- ${sel || "пункт"}` })); close(); }} />
            <ToolbarButton icon={ListOrdered} label="Нумерованный список" onClick={() => { apply((sel) => ({ text: `1. ${sel || "пункт"}` })); close(); }} />
          </>
        )}
      </ToolbarDropdown>

      <ToolbarButton
        icon={ImageIcon}
        label="Изображение"
        onClick={() => {
          const url = window.prompt("Ссылка на изображение:");
          if (url && url.trim()) apply(() => ({ text: `![](${url.trim()})` }));
        }}
      />
      <ToolbarButton icon={Table2} label="Таблица" onClick={() => apply(() => ({ text: "| A | B |\n| - | - |\n| 1 | 2 |" }))} />
      <ToolbarButton icon={Minus} label="Разделитель" onClick={() => apply(() => ({ text: "\n---\n" }))} />

      <ToolbarDropdown icon={Code} label="Код">
        {(close) => (
          <>
            <ToolbarButton icon={Code} label="Код в строке" onClick={() => { apply((sel) => ({ text: `\`${sel || "код"}\`` })); close(); }} />
            <ToolbarButton icon={Code} label="Блок кода" onClick={() => { apply((sel) => ({ text: "```\n" + (sel || "код") + "\n```" })); close(); }} />
          </>
        )}
      </ToolbarDropdown>

      <ToolbarDropdown icon={Sigma} label="Формула">
        {(close) => (
          <>
            <ToolbarButton icon={Sigma} label="Формула (блок)" onClick={() => { apply((sel) => ({ text: `$$\n${sel || "E = mc^2"}\n$$` })); close(); }} />
            <ToolbarButton icon={Superscript} label="Формула (в строке)" onClick={() => { apply((sel) => ({ text: `$${sel || "x^2"}$` })); close(); }} />
          </>
        )}
      </ToolbarDropdown>

      <ToolbarButton
        icon={EyeOff}
        label="Спойлер"
        onClick={() => apply((sel) => ({ text: `::: spoiler Спойлер\n${sel || "текст"}\n:::` }))}
      />
      <ToolbarButton
        icon={AnchorIcon}
        label="Якорь"
        onClick={() => {
          const name = window.prompt("Имя якоря (латиница/цифры/дефис):");
          if (name && name.trim()) apply(() => ({ text: `{#${name.trim()}}` }));
        }}
      />
      <ToolbarButton icon={AtSign} label="Персона" onClick={() => apply(() => ({ text: "@" }))} />
    </div>
  );
}