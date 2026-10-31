import { useState } from "react";
import { AdminDialog } from "./AdminDialog";
import { BTN, BTN_DANGER } from "./adminShared";

export function DeleteWithReasonDialog({
  title,
  description,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
      setPending(false);
    }
  };

  return (
    <AdminDialog title={title} onClose={onClose}>
      <p className="text-sm dark:text-gray-200">{description}</p>
      <label className="mt-3 block text-sm dark:text-gray-200">
        Причина
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
        />
      </label>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Удаление необратимо. Снимок содержимого и причина сохранятся в журнале.
      </p>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className={BTN} onClick={onClose}>
          Отмена
        </button>
        <button className={BTN_DANGER} disabled={reason.trim().length < 3 || pending} onClick={submit}>
          Удалить
        </button>
      </div>
    </AdminDialog>
  );
}