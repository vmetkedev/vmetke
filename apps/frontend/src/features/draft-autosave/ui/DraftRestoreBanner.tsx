interface DraftRestoreBannerProps {
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}

function formatSavedAt(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  const time = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  if (isToday) {
    return `сегодня в ${time}`;
  }

  const day = date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return `${day} в ${time}`;
}

export function DraftRestoreBanner({ savedAt, onRestore, onDiscard }: DraftRestoreBannerProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900 dark:bg-blue-950/40">
      <div className="flex items-center gap-2.5 text-blue-800 dark:text-blue-300">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4 shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>У вас есть резервное сохранение материала от {formatSavedAt(savedAt)}.</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onRestore}
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Восстановить
        </button>
        <button
          type="button"
          onClick={onDiscard}
          aria-label="Удалить черновик"
          title="Удалить черновик"
          className="rounded p-1 text-gray-400 hover:bg-blue-100 hover:text-gray-600 dark:hover:bg-blue-900/40 dark:hover:text-gray-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}