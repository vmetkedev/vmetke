import { useEffect, useRef, useState } from "react";
import { Ban, Settings, Trash2 } from "lucide-react";

type Props = {
  blocked: boolean;
  canBlock: boolean;
  busy?: boolean;
  onBlockToggle: () => void;
  onDelete: () => void;
};

export function ConversationMenu({ blocked, canBlock, busy = false, onBlockToggle, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Настройки диалога"
        title="Настройки диалога"
        aria-haspopup="menu"
        aria-expanded={open}
        className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      >
        <Settings size={18} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-20 w-52 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1"
        >
          {canBlock && (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => choose(onBlockToggle)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <Ban size={14} />
              {blocked ? "Разблокировать" : "Заблокировать"}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onDelete)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 size={14} />
            Удалить диалог
          </button>
        </div>
      )}
    </div>
  );
}