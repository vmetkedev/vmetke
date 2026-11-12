import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import type { Conversation } from "../lib/messages";

export function ForwardModal({
  conversations,
  preview,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  conversations: Conversation[];
  preview: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (conversationId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.otherUser.username.toLowerCase().includes(q) ||
        (c.otherUser.displayName ?? "").toLowerCase().includes(q),
    );
  }, [conversations, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Переслать сообщение"
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg bg-white shadow-xl dark:bg-gray-800"
      >
        <div className="border-b px-4 py-3 dark:border-gray-700">
          <h2 className="text-sm font-semibold dark:text-gray-100">Переслать сообщение</h2>
          <p className="mt-1 line-clamp-2 whitespace-pre-wrap wrap-anywhere text-xs text-gray-500 dark:text-gray-400">
            {preview}
          </p>
        </div>

        <div className="border-b p-3 dark:border-gray-700">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по диалогам"
            aria-label="Поиск по диалогам"
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div role="radiogroup" aria-label="Диалоги" className="min-h-24 flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Нет диалогов. Напишите кому-нибудь из профиля, чтобы было куда пересылать.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Ничего не найдено
            </p>
          ) : (
            filtered.map((c) => {
              const isSelected = selected === c.id;
              const name = c.otherUser.displayName || c.otherUser.username;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={busy}
                  onClick={() => setSelected(c.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-60 dark:hover:bg-gray-700 ${
                    isSelected ? "bg-blue-50 dark:bg-gray-700" : ""
                  }`}
                >
                  <Avatar
                    username={c.otherUser.username}
                    displayName={c.otherUser.displayName}
                    avatarColor={c.otherUser.avatarColor}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium dark:text-gray-100">
                      {name}
                    </span>
                    {c.otherUser.displayName && (
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                        @{c.otherUser.username}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {error && (
          <p role="alert" className="px-4 pt-2 text-xs text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 p-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => selected !== null && onConfirm(selected)}
            disabled={busy || selected === null}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Отправка..." : "Переслать"}
          </button>
        </div>
      </div>
    </div>
  );
}