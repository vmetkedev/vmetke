import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { deleteAccount } from "../lib/account";
import { updateAvatarColor } from "../lib/users";
import { fetchBlockedUsers, unblockUser, type BlockedUser } from "../lib/messages";
import { Avatar } from "../components/Avatar";
import { AVATAR_PALETTE } from "../lib/avatarPalette";

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [blockedError, setBlockedError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBlockedUsers()
      .then((data) => {
        if (!cancelled) setBlocked(data.blocked);
      })
      .catch((err) => {
        if (!cancelled) setBlockedError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setBlockedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAvatarSelect = async (colorIndex: number) => {
    if (!user || colorIndex === user.avatarColor) return;
    setAvatarSaving(true);
    setAvatarError(null);
    const previous = user.avatarColor;
    updateUser({ avatarColor: colorIndex });
    try {
      await updateAvatarColor(colorIndex);
    } catch (err) {
      updateUser({ avatarColor: previous });
      setAvatarError((err as Error).message);
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleUnblock = async (u: BlockedUser) => {
    setUnblockingId(u.id);
    setBlockedError(null);
    try {
      await unblockUser(u.id);
      setBlocked((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      setBlockedError((err as Error).message);
    } finally {
      setUnblockingId(null);
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
          <h2 className="font-medium dark:text-gray-100">Аватар</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Выберите цвет для своего аватара.</p>
          {avatarError && <p className="text-sm text-red-600">{avatarError}</p>}
          <div className="flex items-center gap-3 flex-wrap">
            {user && (
              <Avatar username={user.username} avatarColor={user.avatarColor} size="lg" />
            )}
            <div className="flex flex-wrap gap-2">
              {AVATAR_PALETTE.map((color, index) => (
                <button
                  key={index}
                  onClick={() => handleAvatarSelect(index)}
                  disabled={avatarSaving}
                  aria-label={`Цвет ${index + 1}`}
                  className={`w-8 h-8 rounded-full disabled:opacity-50 ${
                    user?.avatarColor === index ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800" : ""
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-3">
          <h2 className="font-medium dark:text-gray-100">Заблокированные пользователи</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Заблокированные не могут писать вам, а вы не можете писать им.
          </p>
          {blockedError && <p className="text-sm text-red-600">{blockedError}</p>}
          {blockedLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка...</p>
          ) : blocked.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Вы никого не блокировали.</p>
          ) : (
            <ul className="divide-y dark:divide-gray-700">
              {blocked.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-2">
                  <Avatar
                    username={u.username}
                    displayName={u.displayName}
                    avatarColor={u.avatarColor}
                    size="sm"
                  />
                  <Link
                    to={`/u/${u.username}`}
                    className="flex-1 min-w-0 truncate text-sm hover:underline dark:text-gray-100"
                  >
                    {u.displayName || u.username}
                  </Link>
                  <button
                    onClick={() => handleUnblock(u)}
                    disabled={unblockingId === u.id}
                    className="text-sm rounded px-3 py-1 border dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50"
                  >
                    Разблокировать
                  </button>
                </li>
              ))}
            </ul>
          )}
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