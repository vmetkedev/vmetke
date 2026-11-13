import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Plus, Trash2 } from "lucide-react";

const btnClass =
  "p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs flex items-center gap-1";
const dangerBtnClass = "p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 text-xs flex items-center gap-1";
const dividerClass = "w-px h-4 bg-gray-200 dark:bg-gray-600 mx-0.5";

export function TableToolbar({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu editor={editor} shouldShow={({ editor }) => editor.isActive("table")}>
      <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 p-1">
        <button onClick={() => editor.chain().focus().addRowBefore().run()} title="Строка выше" className={btnClass}>
          <Plus size={12} /> строка↑
        </button>
        <button onClick={() => editor.chain().focus().addRowAfter().run()} title="Строка ниже" className={btnClass}>
          <Plus size={12} /> строка↓
        </button>
        <button onClick={() => editor.chain().focus().deleteRow().run()} title="Удалить строку" className={dangerBtnClass}>
          <Trash2 size={12} /> строку
        </button>

        <div className={dividerClass} />

        <button onClick={() => editor.chain().focus().addColumnBefore().run()} title="Колонка слева" className={btnClass}>
          <Plus size={12} /> кол.←
        </button>
        <button onClick={() => editor.chain().focus().addColumnAfter().run()} title="Колонка справа" className={btnClass}>
          <Plus size={12} /> кол.→
        </button>
        <button onClick={() => editor.chain().focus().deleteColumn().run()} title="Удалить колонку" className={dangerBtnClass}>
          <Trash2 size={12} /> кол.
        </button>

        <div className={dividerClass} />

        <button onClick={() => editor.chain().focus().mergeCells().run()} title="Объединить ячейки" className={btnClass}>
          Объединить
        </button>
        <button onClick={() => editor.chain().focus().splitCell().run()} title="Разделить ячейку" className={btnClass}>
          Разделить
        </button>

        <div className={dividerClass} />

        <button onClick={() => editor.chain().focus().deleteTable().run()} title="Удалить таблицу" className={dangerBtnClass}>
          <Trash2 size={12} /> таблицу
        </button>
      </div>
    </BubbleMenu>
  );
}