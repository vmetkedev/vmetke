import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Heading, Quote, List, ListOrdered, Minus, Image as ImageIcon } from "lucide-react";
import type { Editor, Range } from "@tiptap/core";

export type CommandItem = {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  command: (props: { editor: Editor; range: Range }) => void;
};

export const COMMAND_ITEMS: CommandItem[] = [
  {
    title: "Заголовок",
    icon: Heading,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    title: "Цитата",
    icon: Quote,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Список",
    icon: List,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Нумерованный список",
    icon: ListOrdered,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Изображение",
    icon: ImageIcon,
    command: ({ editor, range }) => {
      const url = window.prompt("Ссылка на изображение:");
      if (!url || !url.trim()) {
        editor.chain().focus().deleteRange(range).run();
        return;
      }
      editor.chain().focus().deleteRange(range).setImage({ src: url.trim() }).run();
    },
  },
  {
    title: "Разделитель",
    icon: Minus,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

type Props = {
  items: CommandItem[];
  command: (item: CommandItem) => void;
};

export const CommandList = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, Props>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) command(item);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((selectedIndex + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((selectedIndex + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 overflow-hidden py-1 w-64">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              onClick={() => selectItem(index)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left ${
                index === selectedIndex
                  ? "bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-200"
              }`}
            >
              <Icon size={16} />
              {item.title}
            </button>
          );
        })}
      </div>
    );
  }
);
CommandList.displayName = "CommandList";