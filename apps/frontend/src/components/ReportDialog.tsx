import { useEffect, useState } from "react";
import {
  REPORT_REASONS,
  submitReport,
  type ReportReason,
  type ReportTargetType,
} from "../lib/reports";

const TITLES: Record<ReportTargetType, string> = {
  post: "Пожаловаться на пост",
  comment: "Пожаловаться на комментарий",
  user: "Пожаловаться на пользователя",
  message: "Пожаловаться на сообщение",
};

const BTN = "px-3 py-1.5 text-sm rounded-md border dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700";
const BTN_PRIMARY = "px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white disabled:opacity-50";

export function ReportDialog({
  targetType,
  targetId,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trimmed = comment.trim();
  const canSubmit = !pending && (reason !== "other" || trimmed.length >= 3);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await submitReport({ targetType, targetId, reason, comment: trimmed || undefined });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить жалобу");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !pending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[targetType]}
        className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold dark:text-gray-100">{TITLES[targetType]}</h2>

        {done ? (
          <>
            <p className="mt-3 text-sm dark:text-gray-200">
              Жалоба отправлена. Спасибо, модераторы её рассмотрят.
            </p>
            <div className="mt-4 flex justify-end">
              <button className={BTN} onClick={onClose}>
                Закрыть
              </button>
            </div>
          </>
        ) : (
          <>
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">Причина</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm dark:text-gray-200">
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>

            <label className="mt-3 block text-sm dark:text-gray-200">
              Комментарий {reason === "other" ? "(обязательно)" : "(необязательно)"}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={3}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
              />
            </label>

            {targetType === "message" && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Модераторы увидят это сообщение и несколько предыдущих сообщений диалога. Остальная
                переписка им недоступна.
              </p>
            )}

            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button className={BTN} onClick={onClose} disabled={pending}>
                Отмена
              </button>
              <button className={BTN_PRIMARY} disabled={!canSubmit} onClick={submit}>
                Отправить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}