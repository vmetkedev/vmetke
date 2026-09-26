import type { Editor } from "@tiptap/core";
import { ToolbarDropdown } from "./ToolbarDropdown";
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

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${
        active ? "text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-800" : "text-gray-600 dark:text-gray-300"
      }`}
    >
      <Icon size={18} />
    </button>
  );
}

function ToolbarTextButton({
  text,
  label,
  active,
  onClick,
}: {
  text: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`px-2 py-1 rounded text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 ${
        active ? "text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-800" : "text-gray-600 dark:text-gray-300"
      }`}
    >
      {text}
    </button>
  );
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const insertImage = () => {
    const url = window.prompt("Ссылка на изображение:");
    if (url && url.trim()) editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  const insertAnchor = () => {
    const name = window.prompt("Имя якоря (латиница/цифры/дефис):");
    if (name && name.trim())
      editor.chain().focus().insertContent({ type: "anchor", attrs: { name: name.trim() } }).run();
  };

  return (
    <div className="flex items-center gap-1 flex-wrap border-t dark:border-gray-700 pt-2 mt-2">
      <ToolbarDropdown icon={Type} label="Текст">
        {(close) => (
          <>
            <ToolbarButton icon={Bold} label="Жирный" active={editor.isActive("bold")} onClick={() => { editor.chain().focus().toggleBold().run(); close(); }} />
            <ToolbarButton icon={Italic} label="Курсив" active={editor.isActive("italic")} onClick={() => { editor.chain().focus().toggleItalic().run(); close(); }} />
            <ToolbarButton icon={UnderlineIcon} label="Подчёркнутый" active={editor.isActive("underline")} onClick={() => { editor.chain().focus().toggleUnderline().run(); close(); }} />
            <ToolbarButton icon={Strikethrough} label="Зачёркнутый" active={editor.isActive("strike")} onClick={() => { editor.chain().focus().toggleStrike().run(); close(); }} />
            <ToolbarButton icon={SubscriptIcon} label="Подстрочный" active={editor.isActive("subscript")} onClick={() => { editor.chain().focus().toggleSubscript().run(); close(); }} />
            <ToolbarButton icon={SuperscriptIcon} label="Надстрочный" active={editor.isActive("superscript")} onClick={() => { editor.chain().focus().toggleSuperscript().run(); close(); }} />
            <ToolbarButton icon={Eraser} label="Очистить форматирование" onClick={() => { editor.chain().focus().unsetAllMarks().run(); close(); }} />
          </>
        )}
      </ToolbarDropdown>

      <ToolbarDropdown icon={Heading} label="Заголовок" active={editor.isActive("heading")}>
        {(close) => (
          <>
            <ToolbarTextButton text="H1" label="Заголовок 1" active={editor.isActive("heading", { level: 1 })} onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); close(); }} />
            <ToolbarTextButton text="H2" label="Заголовок 2" active={editor.isActive("heading", { level: 2 })} onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); close(); }} />
            <ToolbarTextButton text="H3" label="Заголовок 3" active={editor.isActive("heading", { level: 3 })} onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); close(); }} />
          </>
        )}
      </ToolbarDropdown>

      <ToolbarButton icon={Quote} label="Цитата" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />

      <ToolbarDropdown icon={List} label="Список" active={editor.isActive("bulletList") || editor.isActive("orderedList")}>
        {(close) => (
          <>
            <ToolbarButton icon={List} label="Маркированный список" active={editor.isActive("bulletList")} onClick={() => { editor.chain().focus().toggleBulletList().run(); close(); }} />
            <ToolbarButton icon={ListOrdered} label="Нумерованный список" active={editor.isActive("orderedList")} onClick={() => { editor.chain().focus().toggleOrderedList().run(); close(); }} />
          </>
        )}
      </ToolbarDropdown>

      <ToolbarButton icon={ImageIcon} label="Изображение" onClick={insertImage} />
      <ToolbarButton icon={Table2} label="Таблица" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      <ToolbarButton icon={Minus} label="Разделитель" onClick={() => editor.chain().focus().setHorizontalRule().run()} />

      <ToolbarDropdown icon={Code} label="Код" active={editor.isActive("code") || editor.isActive("codeBlock")}>
        {(close) => (
          <>
            <ToolbarButton icon={Code} label="Код в строке" active={editor.isActive("code")} onClick={() => { editor.chain().focus().toggleCode().run(); close(); }} />
            <ToolbarButton icon={Code} label="Блок кода" active={editor.isActive("codeBlock")} onClick={() => { editor.chain().focus().toggleCodeBlock().run(); close(); }} />
          </>
        )}
      </ToolbarDropdown>

      <ToolbarDropdown icon={Sigma} label="Формула">
        {(close) => (
          <>
            <ToolbarButton icon={Sigma} label="Формула (блок)" onClick={() => { editor.chain().focus().insertContent({ type: "formula", attrs: { latex: "" } }).run(); close(); }} />
            <ToolbarButton icon={Superscript} label="Формула (в строке)" onClick={() => { editor.chain().focus().insertContent({ type: "inlineFormula", attrs: { latex: "" } }).run(); close(); }} />
          </>
        )}
      </ToolbarDropdown>

      <ToolbarButton
        icon={EyeOff}
        label="Спойлер"
        onClick={() =>
          editor.chain().focus().insertContent({ type: "spoiler", attrs: { title: "Спойлер" }, content: [{ type: "paragraph" }] }).run()
        }
      />
      <ToolbarButton icon={AnchorIcon} label="Якорь" onClick={insertAnchor} />
      <ToolbarButton icon={AtSign} label="Персона" onClick={() => editor.chain().focus().insertContent("@").run()} />
    </div>
  );
}