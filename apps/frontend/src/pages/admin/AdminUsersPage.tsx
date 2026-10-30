import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Avatar } from "../../components/Avatar";
import { fetchAdminUsers, type AdminUsersFilter } from "../../lib/adminApi";
import { BannedBadge, RoleBadge, ROLE_LABELS, fmtDate } from "./adminShared";

const INPUT =
  "border rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100";

export function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<NonNullable<AdminUsersFilter["role"]>>("");
  const [banned, setBanned] = useState<NonNullable<AdminUsersFilter["banned"]>>("");

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useInfiniteQuery({
    queryKey: ["admin", "users", { q, role, banned }],
    queryFn: ({ pageParam }) => fetchAdminUsers({ q, role, banned }, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const users = query.data?.pages.flatMap((p) => p.users) ?? [];

  return (
    <div>
      <h1 className="text-xl font-semibold dark:text-gray-100">Пользователи</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          aria-label="Поиск"
          placeholder="Поиск по username или email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${INPUT} flex-1 min-w-48`}
        />
        <select
          aria-label="Роль"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className={INPUT}
        >
          <option value="">Все роли</option>
          {(["user", "moderator", "admin"] as const).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          aria-label="Блокировка"
          value={banned}
          onChange={(e) => setBanned(e.target.value as typeof banned)}
          className={INPUT}
        >
          <option value="">Все</option>
          <option value="true">Заблокированные</option>
          <option value="false">Не заблокированные</option>
        </select>
      </div>

      {query.isPending && <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>}

      {query.isError && (
        <div className="mt-4 text-sm">
          <p className="text-red-600 dark:text-red-400">Не удалось загрузить пользователей</p>
          <button onClick={() => query.refetch()} className="mt-2 underline dark:text-gray-200">
            Повторить
          </button>
        </div>
      )}

      {query.data && users.length === 0 && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Никого не найдено</p>
      )}

      {users.length > 0 && (
        <ul className="mt-4 divide-y dark:divide-gray-700 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                to={`/admin/users/${u.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Avatar username={u.username} avatarColor={u.avatarColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium dark:text-gray-100">@{u.username}</span>
                    <RoleBadge role={u.role} />
                    {u.bannedAt && <BannedBadge />}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                </div>
                <div className="hidden sm:block text-xs text-gray-400 dark:text-gray-500">
                  {fmtDate(u.createdAt)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {query.hasNextPage && (
        <button
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="mt-4 text-sm underline dark:text-gray-200 disabled:opacity-50"
        >
          {query.isFetchingNextPage ? "Загрузка…" : "Показать ещё"}
        </button>
      )}
    </div>
  );
}