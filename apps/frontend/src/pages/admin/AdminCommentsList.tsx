import { useState } from "react";
import { Link } from "react-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAdminComment,
  fetchAdminComments,
  type AdminCommentListItem,
  type AdminContentFilter,
} from "../../lib/adminApi";
import { DeleteWithReasonDialog } from "./DeleteWithReasonDialog";
import { useAuth } from "../../auth/AuthContext";
import { BTN, DELETE_FORBIDDEN_HINT, canDeleteContent, fmtDate } from "./adminShared";

export function AdminCommentsList({ filter }: { filter: AdminContentFilter }) {
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<AdminCommentListItem | null>(null);
  const { user: me } = useAuth();

  const query = useInfiniteQuery({
    queryKey: ["admin", "content", "comments", filter],
    queryFn: ({ pageParam }) => fetchAdminComments(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.comments) ?? [];

  return (
    <div>
      {query.isPending && <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>}
      {query.isError && (
        <div className="mt-4 text-sm">
          <p className="text-red-600 dark:text-red-400">Не удалось загрузить комментарии</p>
          <button onClick={() => query.refetch()} className="mt-2 underline dark:text-gray-200">
            Повторить
          </button>
        </div>
      )}
      {query.data && items.length === 0 && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Ничего не найдено</p>
      )}

      {items.length > 0 && (
        <ul className="mt-4 divide-y dark:divide-gray-700 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
          {items.map((c) => (
            <li key={c.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm whitespace-pre-wrap break-words dark:text-gray-100">{c.content}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                    <Link to={`/u/${c.author.username}`} className="hover:underline">
                      @{c.author.username}
                    </Link>
                    <span>{fmtDate(c.createdAt)}</span>
                    <span>К посту: {c.post.title || "без заголовка"}</span>
                  </div>
                </div>
                <button
                  className={`${BTN} shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={!canDeleteContent(me, c.author)}
                  title={canDeleteContent(me, c.author) ? undefined : DELETE_FORBIDDEN_HINT}
                  onClick={() => setDeleteTarget(c)}
                >
                  Удалить
                </button>
              </div>
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

      {deleteTarget && (
        <DeleteWithReasonDialog
          title="Удалить комментарий"
          description={`Комментарий автора @${deleteTarget.author.username} будет удалён.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async (reason) => {
            await deleteAdminComment(deleteTarget.id, reason);
            setDeleteTarget(null);
            await qc.invalidateQueries({ queryKey: ["admin", "content"] });
          }}
        />
      )}
    </div>
  );
}