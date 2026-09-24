import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Avatar } from "../Avatar";

type MentionItem = { id: string; username: string; displayName: string | null; avatarColor: number | null };

type Props = {
  items: MentionItem[];
  command: (item: MentionItem) => void;
};

export const MentionList = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, Props>(
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

    if (items.length === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 overflow-hidden py-2 px-3 w-56 text-xs text-gray-400 dark:text-gray-500">
          Ничего не найдено
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 overflow-hidden py-1 w-56">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left ${
              index === selectedIndex
                ? "bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400"
                : "text-gray-700 dark:text-gray-200"
            }`}
          >
            <Avatar username={item.username} displayName={item.displayName} avatarColor={item.avatarColor} size="sm" />
            <span>{item.displayName || item.username}</span>
          </button>
        ))}
      </div>
    );
  }
);
MentionList.displayName = "MentionList";