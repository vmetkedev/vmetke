import { useState } from "react";
import { AdminDialog } from "./AdminDialog";
import { BTN, BTN_DANGER } from "./adminShared";

const BTN_PRIMARY =
  "px-3 py-1.5 text-sm rounded-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 disabled:opacity-50";

export function ResolveDialog({
  title,
  description,
  hint,
  reasonRequired,
  confirmLabel,
  danger = false,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  hint?: string;
  reasonRequired: boolean;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = reason.trim();
  const canSubmit = !pending && (!reasonRequired || trimmed.length >= 3);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить действие");
      setPending(false);
    }
  };

  return (
    <AdminDialog title={title} onClose={onClose}>
      <p className="text-sm dark:text-gray-200">{description}</p>
      <label className="mt-3 block text-sm dark:text-gray-200">
        Причина {reasonRequired ? "" : "(необязательно)"}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
        />
      </label>
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className={BTN} onClick={onClose}>
          Отмена
        </button>
        <button className={danger ? BTN_DANGER : BTN_PRIMARY} disabled={!canSubmit} onClick={submit}>
          {confirmLabel}
        </button>
      </div>
    </AdminDialog>
  );
}