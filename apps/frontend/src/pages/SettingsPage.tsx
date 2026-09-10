import { useState } from "react";
import { useNavigate } from "react-router";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { exportAccountData, deleteAccount } from "../lib/account";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await exportAccountData();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vmetke-export-${user?.username ?? "data"}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(password);
      await logout();
      navigate("/");
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <h1 className="text-xl font-semibold dark:text-gray-100">Настройки аккаунта</h1>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-3">
          <h2 className="font-medium dark:text-gray-100">Экспорт данных</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Скачайте копию всех ваших данных: профиль, посты, комментарии, лайки, закладки и подписки — в формате JSON.
          </p>
          {exportError && <p className="text-sm text-red-600">{exportError}</p>}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-sm rounded px-4 py-1.5 bg-blue-600 text-white disabled:opacity-50"
          >
            {exporting ? "Готовим файл..." : "Скачать мои данные"}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-3 border border-red-200 dark:border-red-900">
          <h2 className="font-medium text-red-600">Удаление аккаунта</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ваш профиль, email и личные данные будут удалены и анонимизированы. Опубликованные посты и комментарии
            останутся видимыми, но будут отображаться от имени «Удалённый пользователь». Это действие необратимо.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm rounded px-4 py-1.5 border border-red-600 text-red-600"
            >
              Удалить аккаунт
            </button>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm text-gray-700 dark:text-gray-200">
                Введите пароль для подтверждения
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-1.5 text-sm"
                  autoFocus
                />
              </label>
              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting || !password}
                  className="text-sm rounded px-4 py-1.5 bg-red-600 text-white disabled:opacity-50"
                >
                  {deleting ? "Удаление..." : "Подтвердить удаление"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setPassword("");
                    setDeleteError(null);
                  }}
                  disabled={deleting}
                  className="text-sm rounded px-4 py-1.5 border dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}