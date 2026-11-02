import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  fetchAdminAudit,
  fetchAdminAuditEntry,
  type AdminAuditFilter,
  type AdminAuditItem,
} from "../../lib/adminApi";
import { ACTION_LABELS, AUDIT_TARGET_LABELS, BTN, fmtDate, useDebounced } from "./adminShared";

const INPUT =
  "border rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100";

const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 8)}…` : id);

function AuditRow({ item }: { item: AdminAuditItem }) {
  const [open, setOpen] = useState(false);
  const detail = useQuery({
    queryKey: ["admin", "audit", "entry", item.id],
    queryFn: () => fetchAdminAuditEntry(item.id),
    enabled: open,
  });

  const targetType = AUDIT_TARGET_LABELS[item.targetType] ?? item.targetType;
  const target = item.targetLabel
    ? `${targetType} · @${item.targetLabel}`
    : item.targetId
      ? `${targetType} · ${shortId(item.targetId)}`
      : targetType;

  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-medium dark:text-gray-100">
              {ACTION_LABELS[item.action] ?? item.action}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-300 break-all">{target}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
            <span>{fmtDate(item.createdAt)}</span>
            <span>{item.admin ? `@${item.admin.username}` : "CLI / система"}</span>
          </div>
          {item.reason && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 break-words">{item.reason}</p>
          )}
        </div>
        <button className={`${BTN} shrink-0`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Скрыть" : "Подробнее"}
        </button>
      </div>

      {open && (
        <div className="mt-3">
          {detail.isPending && <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>}
          {detail.isError && <p className="text-sm text-red-600 dark:text-red-400">Не удалось загрузить запись</p>}
          {detail.data && (
            <>
              <div className="text-xs text-gray-500 dark:text-gray-400 break-all">
                Действие: {detail.data.action} · ID цели: {detail.data.targetId ?? "—"}
              </div>
              <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-50 dark:bg-gray-900 p-3 text-xs dark:text-gray-100">
                {JSON.stringify(detail.data.details, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function AdminAuditPage() {
  const [admin, setAdmin] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const debAdmin = useDebounced(admin.trim().replace(/^@/, ""), 300);
  const debTargetId = useDebounced(targetId.trim(), 300);
  const filter = useMemo<AdminAuditFilter>(
    () => ({ admin: debAdmin, action, targetType, targetId: debTargetId, from, to }),
    [debAdmin, action, targetType, debTargetId, from, to],
  );

  const query = useInfiniteQuery({
    queryKey: ["admin", "audit", "list", filter],
    queryFn: ({ pageParam }) => fetchAdminAudit(filter, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.entries) ?? [];

  return (
    <div>
      <h1 className="text-xl font-semibold dark:text-gray-100">Журнал</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          aria-label="Админ (username)"
          placeholder="Админ"
          value={admin}
          onChange={(e) => setAdmin(e.target.value)}
          className={`${INPUT} w-36`}
        />
        <select aria-label="Действие" value={action} onChange={(e) => setAction(e.target.value)} className={INPUT}>
          <option value="">Все действия</option>
          {Object.entries(ACTION_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Тип цели"
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
          className={INPUT}
        >
          <option value="">Все цели</option>
          {Object.entries(AUDIT_TARGET_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <input
          aria-label="ID цели"
          placeholder="ID цели"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className={`${INPUT} w-44`}
        />
        <input aria-label="С даты" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={INPUT} />
        <input aria-label="По дату" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={INPUT} />
      </div>

      {query.isPending && <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>}

      {query.isError && (
        <div className="mt-4 text-sm">
          <p className="text-red-600 dark:text-red-400">Не удалось загрузить журнал</p>
          <button onClick={() => query.refetch()} className="mt-2 underline dark:text-gray-200">
            Повторить
          </button>
        </div>
      )}

      {query.data && items.length === 0 && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Записей нет</p>
      )}

      {items.length > 0 && (
        <ul className="mt-4 divide-y dark:divide-gray-700 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
          {items.map((item) => (
            <AuditRow key={item.id} item={item} />
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