import { useEffect } from "react";
import type { DeleteScope } from "../lib/messages";

type Props = {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  userName?: string;
  onClose: () => void;
  onConfirm: (scope: DeleteScope) => void;
};

export function DeleteConversationModal({
  open,
  busy = false,
  error,
  userName,
  onClose,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-conversation-title"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="delete-conversation-title"
          className="text-base font-semibold dark:text-gray-100"
        >
          Удалить диалог?
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {userName ? `Диалог с ${userName}.` : "Этот диалог."} Выберите, для кого он будет удалён.
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm("me")}
            className="w-full text-left border dark:border-gray-600 rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <span className="block text-sm font-medium dark:text-gray-100">Удалить у меня</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              История скроется только для вас, у собеседника она сохранится.
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm("all")}
            className="w-full text-left border border-red-300 dark:border-red-800 rounded px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
          >
            <span className="block text-sm font-medium text-red-600 dark:text-red-400">
              Удалить у всех
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              Диалог исчезнет у обоих участников. Это действие нельзя отменить.
            </span>
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-4 text-right">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="text-sm text-gray-600 dark:text-gray-300 hover:underline disabled:opacity-50"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}