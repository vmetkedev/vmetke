import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, type UserRole } from "../../auth/AuthContext";
import { Avatar } from "../../components/Avatar";
import {
  banAdminUser,
  changeAdminUserRole,
  fetchAdminUser,
  forceLogoutAdminUser,
  unbanAdminUser,
} from "../../lib/adminApi";
import { AdminDialog } from "./AdminDialog";
import { BannedBadge, RoleBadge, ROLE_LABELS, fmtDate } from "./adminShared";

type DialogKind = "ban" | "unban" | "role" | "logout" | null;

const BTN =
  "px-3 py-1.5 text-sm rounded-md border dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700";
const BTN_PRIMARY = "px-3 py-1.5 text-sm rounded-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 disabled:opacity-50";
const BTN_DANGER = "px-3 py-1.5 text-sm rounded-md bg-red-600 text-white disabled:opacity-50";

export function AdminUserPage() {
  const { id = "" } = useParams();
  const { user: me } = useAuth();
  const qc = useQueryClient();

  const { data: user, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => fetchAdminUser(id),
  });

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [reason, setReason] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("moderator");

  const act = useMutation({
    mutationFn: (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "user", id] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setDialog(null);
    },
  });

  const open = (kind: Exclude<DialogKind, null>) => {
    act.reset();
    setReason("");
    if (user) setNewRole(user.role === "moderator" ? "user" : "moderator");
    setDialog(kind);
  };
  const close = () => setDialog(null);

  if (isPending) return <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>;
  if (isError || !user) {
    return (
      <div className="text-sm">
        <p className="text-red-600 dark:text-red-400">Не удалось загрузить пользователя</p>
        <button onClick={() => refetch()} className="mt-2 underline dark:text-gray-200">
          Повторить
        </button>
      </div>
    );
  }

  const isSelf = me?.id === user.id;
  const roleChoices = (["user", "moderator", "admin"] as const).filter((r) => r !== user.role);
  const errorText = act.error ? act.error.message : null;

  return (
    <div>
      <Link to="/admin/users" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
        ← К списку
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <Avatar username={user.username} avatarColor={user.avatarColor} size="sm" />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold dark:text-gray-100">@{user.username}</h1>
            <RoleBadge role={user.role} />
            {user.bannedAt && <BannedBadge />}
          </div>
          {user.displayName && (
            <div className="text-sm text-gray-500 dark:text-gray-400">{user.displayName}</div>
          )}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-gray-500 dark:text-gray-400">Email</dt>
        <dd className="dark:text-gray-100 break-all">{user.email}</dd>
        <dt className="text-gray-500 dark:text-gray-400">Регистрация</dt>
        <dd className="dark:text-gray-100">{fmtDate(user.createdAt)}</dd>
        <dt className="text-gray-500 dark:text-gray-400">Последняя активность</dt>
        <dd className="dark:text-gray-100">{fmtDate(user.lastActiveAt)}</dd>
        <dt className="text-gray-500 dark:text-gray-400">Постов</dt>
        <dd className="dark:text-gray-100">{user.postsCount}</dd>
        <dt className="text-gray-500 dark:text-gray-400">Комментариев</dt>
        <dd className="dark:text-gray-100">{user.commentsCount}</dd>
        {user.bio && (
          <>
            <dt className="text-gray-500 dark:text-gray-400">О себе</dt>
            <dd className="dark:text-gray-100 whitespace-pre-wrap">{user.bio}</dd>
          </>
        )}
        {user.bannedAt && (
          <>
            <dt className="text-gray-500 dark:text-gray-400">Блокировка</dt>
            <dd className="dark:text-gray-100">
              {fmtDate(user.bannedAt)}
              {user.banReason ? `: ${user.banReason}` : ""}
            </dd>
          </>
        )}
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        {isSelf ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Это вы: действия над собой недоступны.</p>
        ) : (
          <>
            {user.bannedAt ? (
              <button className={BTN} onClick={() => open("unban")}>
                Разблокировать
              </button>
            ) : (
              <button className={BTN} onClick={() => open("ban")}>
                Заблокировать
              </button>
            )}
            <button className={BTN} onClick={() => open("role")}>
              Сменить роль
            </button>
            <button className={BTN} onClick={() => open("logout")}>
              Завершить все сессии
            </button>
          </>
        )}
      </div>

      {dialog === "ban" && (
        <AdminDialog title="Заблокировать пользователя" onClose={close}>
          <label className="block text-sm dark:text-gray-200">
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
            Вход будет закрыт, все сессии завершены. Причина попадёт в журнал.
          </p>
          {errorText && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errorText}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button className={BTN} onClick={close}>
              Отмена
            </button>
            <button
              className={BTN_DANGER}
              disabled={reason.trim().length < 3 || act.isPending}
              onClick={() => act.mutate(() => banAdminUser(user.id, reason.trim()))}
            >
              Заблокировать
            </button>
          </div>
        </AdminDialog>
      )}

      {dialog === "unban" && (
        <AdminDialog title="Разблокировать пользователя" onClose={close}>
          <p className="text-sm dark:text-gray-200">@{user.username} снова сможет войти в аккаунт.</p>
          {errorText && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errorText}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button className={BTN} onClick={close}>
              Отмена
            </button>
            <button
              className={BTN_PRIMARY}
              disabled={act.isPending}
              onClick={() => act.mutate(() => unbanAdminUser(user.id))}
            >
              Разблокировать
            </button>
          </div>
        </AdminDialog>
      )}

      {dialog === "role" && (
        <AdminDialog title="Сменить роль" onClose={close}>
          <label className="block text-sm dark:text-gray-200">
            Новая роль
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
            >
              {roleChoices.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          {errorText && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errorText}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button className={BTN} onClick={close}>
              Отмена
            </button>
            <button
              className={BTN_PRIMARY}
              disabled={act.isPending || newRole === user.role}
              onClick={() => act.mutate(() => changeAdminUserRole(user.id, newRole))}
            >
              Сменить роль
            </button>
          </div>
        </AdminDialog>
      )}

      {dialog === "logout" && (
        <AdminDialog title="Завершить все сессии" onClose={close}>
          <p className="text-sm dark:text-gray-200">
            @{user.username} будет разлогинен на всех устройствах и сможет войти заново.
          </p>
          {errorText && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errorText}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button className={BTN} onClick={close}>
              Отмена
            </button>
            <button
              className={BTN_PRIMARY}
              disabled={act.isPending}
              onClick={() => act.mutate(() => forceLogoutAdminUser(user.id))}
            >
              Завершить сессии
            </button>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}