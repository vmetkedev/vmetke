import { useState } from "react";
import { Link } from "react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchAdminReports, type AdminReportsFilter } from "../../lib/adminApi";
import { StatusBadge, TARGET_LABELS, fmtDate, reasonLabel } from "./adminShared";

const INPUT =
  "border rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100";

export function AdminReportsPage() {
  const [status, setStatus] = useState<AdminReportsFilter["status"]>("open");
  const [targetType, setTargetType] = useState<AdminReportsFilter["targetType"]>("");
  const filter: AdminReportsFilter = { status, targetType };

  const query = useInfiniteQuery({
    queryKey: ["admin", "reports", filter],
    queryFn: ({ pageParam }) => fetchAdminReports(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.reports) ?? [];

  return (
    <div>
      <h1 className="text-xl font-semibold dark:text-gray-100">Жалобы</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          aria-label="Статус"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className={INPUT}
        >
          <option value="open">Открытые</option>
          <option value="resolved">Решённые</option>
          <option value="dismissed">Отклонённые</option>
          <option value="all">Все</option>
        </select>
        <select
          aria-label="Тип"
          value={targetType}
          onChange={(e) => setTargetType(e.target.value as typeof targetType)}
          className={INPUT}
        >
          <option value="">Все типы</option>
          <option value="post">Посты</option>
          <option value="comment">Комментарии</option>
          <option value="user">Пользователи</option>
          <option value="message">Сообщения</option>
        </select>
      </div>

      {query.isPending && <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>}

      {query.isError && (
        <div className="mt-4 text-sm">
          <p className="text-red-600 dark:text-red-400">Не удалось загрузить жалобы</p>
          <button onClick={() => query.refetch()} className="mt-2 underline dark:text-gray-200">
            Повторить
          </button>
        </div>
      )}

      {query.data && items.length === 0 && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Жалоб нет</p>
      )}

      {items.length > 0 && (
        <ul className="mt-4 divide-y dark:divide-gray-700 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                to={`/admin/reports/${r.id}`}
                className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium dark:text-gray-100">{TARGET_LABELS[r.targetType]}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{reasonLabel(r.reason)}</span>
                  <StatusBadge status={r.status} />
                </div>
                {r.preview && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2 break-words">
                    {r.preview}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>От: {r.reporter ? `@${r.reporter.username}` : "удалённый пользователь"}</span>
                  <span>На: {r.targetUser ? `@${r.targetUser.username}` : "удалённый пользователь"}</span>
                  <span>{fmtDate(r.createdAt)}</span>
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