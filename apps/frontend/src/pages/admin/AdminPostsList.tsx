import { useState } from "react";
import { Link } from "react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAdminPost,
  fetchAdminPost,
  fetchAdminPosts,
  type AdminContentFilter,
  type AdminPostDetail,
} from "../../lib/adminApi";
import { AdminDialog } from "./AdminDialog";
import { DeleteWithReasonDialog } from "./DeleteWithReasonDialog";
import { useAuth } from "../../auth/AuthContext";
import { BTN, BTN_DANGER, DELETE_FORBIDDEN_HINT, canDeleteContent, fmtDate } from "./adminShared";

type DeleteTarget = { id: string; title: string | null; author: { username: string } };

function ViewPostDialog({
  id,
  onClose,
  onDelete,
}: {
  id: string;
  onClose: () => void;
  onDelete: (post: AdminPostDetail) => void;
}) {
  const { user: me } = useAuth();
  const { data, isPending, isError } = useQuery({
    queryKey: ["admin", "content", "post", id],
    queryFn: () => fetchAdminPost(id),
  });

  return (
    <AdminDialog title="Просмотр поста" onClose={onClose} wide>
      {isPending && <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>}
      {isError && <p className="text-sm text-red-600 dark:text-red-400">Не удалось загрузить пост</p>}
      {data && (
        <>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            @{data.author.username} · {fmtDate(data.createdAt)} · просмотров: {data.views}
          </div>
          {data.title && <h3 className="mt-2 font-medium dark:text-gray-100">{data.title}</h3>}
          {data.tags.length > 0 && (
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {data.tags.map((t) => `#${t}`).join(" ")}
            </div>
          )}
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-50 dark:bg-gray-900 p-3 text-sm font-sans dark:text-gray-100">
            {data.content}
          </pre>
        </>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button className={BTN} onClick={onClose}>
          Закрыть
        </button>
        {data && (
          <button
            className={`${BTN_DANGER} disabled:cursor-not-allowed`}
            disabled={!canDeleteContent(me, data.author)}
            title={canDeleteContent(me, data.author) ? undefined : DELETE_FORBIDDEN_HINT}
            onClick={() => onDelete(data)}
          >
            Удалить
          </button>
        )}
      </div>
    </AdminDialog>
  );
}

export function AdminPostsList({ filter }: { filter: AdminContentFilter }) {
  const qc = useQueryClient();
  const [viewId, setViewId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const { user: me } = useAuth();

  const query = useInfiniteQuery({
    queryKey: ["admin", "content", "posts", filter],
    queryFn: ({ pageParam }) => fetchAdminPosts(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div>
      {query.isPending && <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>}
      {query.isError && (
        <div className="mt-4 text-sm">
          <p className="text-red-600 dark:text-red-400">Не удалось загрузить посты</p>
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
          {items.map((p) => (
            <li key={p.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium dark:text-gray-100">{p.title || "Без заголовка"}</div>
                  <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300 line-clamp-2 break-words">
                    {p.excerpt}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                    <Link to={`/u/${p.author.username}`} className="hover:underline">
                      @{p.author.username}
                    </Link>
                    <span>{fmtDate(p.createdAt)}</span>
                    <span>Лайков: {p.likesCount}</span>
                    <span>Комментариев: {p.commentsCount}</span>
                    <span>Просмотров: {p.views}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className={BTN} onClick={() => setViewId(p.id)}>
                    Открыть
                  </button>
                  <button
                    className={`${BTN} disabled:opacity-50 disabled:cursor-not-allowed`}
                    disabled={!canDeleteContent(me, p.author)}
                    title={canDeleteContent(me, p.author) ? undefined : DELETE_FORBIDDEN_HINT}
                    onClick={() => setDeleteTarget(p)}
                  >
                    Удалить
                  </button>
                </div>
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

      {viewId && (
        <ViewPostDialog
          id={viewId}
          onClose={() => setViewId(null)}
          onDelete={(post) => {
            setViewId(null);
            setDeleteTarget(post);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteWithReasonDialog
          title="Удалить пост"
          description={`Пост «${deleteTarget.title || "без заголовка"}» автора @${deleteTarget.author.username} будет удалён вместе с комментариями, лайками и закладками.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async (reason) => {
            await deleteAdminPost(deleteTarget.id, reason);
            setDeleteTarget(null);
            await qc.invalidateQueries({ queryKey: ["admin", "content"] });
          }}
        />
      )}
    </div>
  );
}