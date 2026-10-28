import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CornerUpLeft, Forward, Pencil, Trash2 } from "lucide-react";

const MENU_WIDTH = 192;

export function MessageMenu({
  anchor,
  mine,
  canReply = true,
  canEdit = false,
  onReply,
  onForward,
  onEdit,
  onDeleteForMe,
  onDeleteForAll,
  onClose,
}: {
  anchor: DOMRect;
  mine: boolean;
  canReply?: boolean;
  canEdit?: boolean;
  onReply: () => void;
  onForward: () => void;
  onEdit?: () => void;
  onDeleteForMe: () => void;
  onDeleteForAll: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"main" | "delete">("main");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (ref.current?.contains(target)) return;
      // клик по пузырю сообщения и по кнопке лайка обрабатывают они сами:
      // иначе меню закрылось бы раньше, чем сработает click
      if (target.closest?.("[data-message-bubble], [data-like-button]")) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const placeAbove = window.innerHeight - anchor.bottom < 190;
  const rawLeft = mine ? anchor.right - MENU_WIDTH : anchor.left;
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - MENU_WIDTH - 8));

  const item =
    "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-100";

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        top: placeAbove ? anchor.top - 4 : anchor.bottom + 4,
        left,
        width: MENU_WIDTH,
        transform: placeAbove ? "translateY(-100%)" : undefined,
      }}
      className="z-50 rounded-lg border bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
    >
      {view === "main" ? (
        <>
          {canReply && (
            <button role="menuitem" className={item} onClick={onReply}>
              <CornerUpLeft size={14} />
              Ответить
            </button>
          )}
          <button role="menuitem" className={item} onClick={onForward}>
            <Forward size={14} />
            Переслать
          </button>
          {canEdit && (
            <button role="menuitem" className={item} onClick={onEdit}>
              <Pencil size={14} />
              Изменить
            </button>
          )}
          <button role="menuitem" className={item} onClick={() => setView("delete")}>
            <Trash2 size={14} />
            Удалить
          </button>
        </>
      ) : (
        <>
          <button role="menuitem" className={`${item} text-gray-500`} onClick={() => setView("main")}>
            <ArrowLeft size={14} />
            Назад
          </button>
          <button role="menuitem" className={item} onClick={onDeleteForMe}>
            Удалить у меня
          </button>
          {mine && (
            <button role="menuitem" className={`${item} text-red-600`} onClick={onDeleteForAll}>
              Удалить у всех
            </button>
          )}
        </>
      )}
    </div>
  );
}