import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/entities/session";
import {
  fetchAdminReport,
  resolveAdminReport,
  type ReportAction,
  type ReportResolution,
} from "../api/admin";
import type { ReportTargetType } from "@/entities/report";
import { ResolveDialog } from "./ResolveDialog";
import {
  BTN,
  DELETE_FORBIDDEN_HINT,
  RoleBadge,
  StatusBadge,
  TARGET_LABELS,
  canDeleteContent,
  fmtDate,
  reasonLabel,
} from "./adminShared";

const BAN_FORBIDDEN_HINT = "Блокировать пользователей может только администратор";

const RESOLUTION_LABELS: Record<ReportResolution, string> = {
  content_deleted: "Контент удалён",
  author_banned: "Автор заблокирован",
  dismissed: "Жалоба отклонена",
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const TEXT_BOX =
  "mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-50 dark:bg-gray-900 p-3 text-sm dark:text-gray-100";

function SnapshotView({ type, snapshot }: { type: ReportTargetType; snapshot: Record<string, unknown> }) {
  if (type === "post") {
    const tags = Array.isArray(snapshot.tags) ? (snapshot.tags as string[]) : [];
    return (
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Автор: {str(snapshot.authorUsername)} · {fmtDate(str(snapshot.createdAt) || null)}
        </div>
        {str(snapshot.title) && <h3 className="mt-2 font-medium dark:text-gray-100">{str(snapshot.title)}</h3>}
        {tags.length > 0 && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tags.map((t) => `#${t}`).join(" ")}</div>
        )}
        <pre className={`${TEXT_BOX} font-sans`}>{str(snapshot.content)}</pre>
      </div>
    );
  }

  if (type === "comment") {
    return (
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Автор: {str(snapshot.authorUsername)} · {fmtDate(str(snapshot.createdAt) || null)}
        </div>
        <pre className={`${TEXT_BOX} font-sans`}>{str(snapshot.content)}</pre>
      </div>
    );
  }

  if (type === "user") {
    return (
      <div className="text-sm dark:text-gray-100">
        <div className="font-medium">{str(snapshot.username)}</div>
        {str(snapshot.displayName) && <div className="text-gray-500 dark:text-gray-400">{str(snapshot.displayName)}</div>}
        <pre className={`${TEXT_BOX} font-sans`}>{str(snapshot.bio) || "О себе ничего не указано"}</pre>
      </div>
    );
  }

  const message = (snapshot.message ?? {}) as Record<string, unknown>;
  const context = Array.isArray(snapshot.context) ? (snapshot.context as Record<string, unknown>[]) : [];
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Показано только то, что приложил жалобщик: само сообщение и несколько предыдущих. Остальная переписка
        недоступна.
      </p>
      {context.length > 0 && (
        <ul className="mt-2 space-y-1">
          {context.map((c, i) => (
            <li key={i} className="rounded-md bg-gray-50 dark:bg-gray-900 p-2 text-sm dark:text-gray-300">
              <span className="text-xs text-gray-500 dark:text-gray-400">{str(c.senderUsername)}: </span>
              <span className="whitespace-pre-wrap break-words">{str(c.content)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 rounded-md border-2 border-red-300 dark:border-red-800 p-2 text-sm dark:text-gray-100">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Жалоба на сообщение · {str(message.senderUsername)} · {fmtDate(str(message.createdAt) || null)}
        </div>
        <div className="mt-1 whitespace-pre-wrap break-words">{str(message.content)}</div>
      </div>
    </div>
  );
}

export function AdminReportPage() {
  const { id = "" } = useParams();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<ReportAction | null>(null);

  const { data: report, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "report", id],
    queryFn: () => fetchAdminReport(id),
  });

  if (isPending) return <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>;
  if (isError || !report) {
    return (
      <div className="text-sm">
        <p className="text-red-600 dark:text-red-400">Не удалось загрузить жалобу</p>
        <button onClick={() => refetch()} className="mt-2 underline dark:text-gray-200">
          Повторить
        </button>
      </div>
    );
  }

  const author = report.targetUser;
  const isOpen = report.status === "open";
  const isAdmin = me?.role === "admin";
  const canDeleteType = report.targetType === "post" || report.targetType === "comment";

  const deleteDisabledHint = !report.contentExists
    ? "Контент уже удалён"
    : author && !canDeleteContent(me, author)
      ? DELETE_FORBIDDEN_HINT
      : null;

  const banDisabledHint = !isAdmin
    ? BAN_FORBIDDEN_HINT
    : !author || author.deletedAt
      ? "Автор удалил аккаунт"
      : author.id === me?.id
        ? "Нельзя заблокировать себя"
        : null;

  const finish = async (action: ReportAction, reason: string) => {
    await resolveAdminReport(report.id, action, reason);
    setDialog(null);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin", "report", id] }),
      qc.invalidateQueries({ queryKey: ["admin", "reports"] }),
    ]);
  };

  const dt = "text-gray-500 dark:text-gray-400";
  const dd = "dark:text-gray-100 break-words";

  return (
    <div>
      <Link to="/admin/reports" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
        ← К списку
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold dark:text-gray-100">Жалоба: {TARGET_LABELS[report.targetType]}</h1>
        <StatusBadge status={report.status} />
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className={dt}>Причина</dt>
        <dd className={dd}>{reasonLabel(report.reason)}</dd>
        {report.comment && (
          <>
            <dt className={dt}>Комментарий жалобщика</dt>
            <dd className={`${dd} whitespace-pre-wrap`}>{report.comment}</dd>
          </>
        )}
        <dt className={dt}>Жалобщик</dt>
        <dd className={dd}>{report.reporter ? `@${report.reporter.username}` : "удалённый пользователь"}</dd>
        <dt className={dt}>На кого</dt>
        <dd className={`${dd} flex flex-wrap items-center gap-2`}>
          {author ? (
            isAdmin ? (
              <Link to={`/admin/users/${author.id}`} className="underline">
                @{author.username}
              </Link>
            ) : (
              <span>@{author.username}</span>
            )
          ) : (
            "удалённый пользователь"
          )}
          {author && <RoleBadge role={author.role} />}
          {author?.bannedAt && <span className="text-xs text-red-600 dark:text-red-400">уже заблокирован</span>}
        </dd>
        <dt className={dt}>Дата</dt>
        <dd className={dd}>{fmtDate(report.createdAt)}</dd>
        {isOpen && report.openReportsForTarget > 1 && (
          <>
            <dt className={dt}>Открытых жалоб на объект</dt>
            <dd className={dd}>{report.openReportsForTarget}</dd>
          </>
        )}
      </dl>

      <section className="mt-5">
        <h2 className="text-sm font-medium text-gray-600 dark:text-gray-300">Снимок на момент жалобы</h2>
        <div className="mt-2">
          <SnapshotView type={report.targetType} snapshot={report.snapshot} />
        </div>
      </section>

      {!isOpen && (
        <section className="mt-5 rounded-md bg-gray-50 dark:bg-gray-900 p-3 text-sm dark:text-gray-100">
          <div className="font-medium">
            {report.resolutionAction ? RESOLUTION_LABELS[report.resolutionAction] : "Обработана"}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {report.resolvedBy ? `@${report.resolvedBy.username}` : "модератор"} · {fmtDate(report.resolvedAt)}
          </div>
          {report.resolutionReason && <p className="mt-1 whitespace-pre-wrap break-words">{report.resolutionReason}</p>}
        </section>
      )}

      {isOpen && (
        <div className="mt-6 flex flex-wrap gap-2">
          {canDeleteType && (
            <button
              className={`${BTN} disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={deleteDisabledHint !== null}
              title={deleteDisabledHint ?? undefined}
              onClick={() => setDialog("delete_content")}
            >
              Удалить контент
            </button>
          )}
          <button
            className={`${BTN} disabled:opacity-50 disabled:cursor-not-allowed`}
            disabled={banDisabledHint !== null}
            title={banDisabledHint ?? undefined}
            onClick={() => setDialog("ban_author")}
          >
            Заблокировать автора
          </button>
          <button className={BTN} onClick={() => setDialog("dismiss")}>
            Отклонить
          </button>
        </div>
      )}

      {dialog === "delete_content" && (
        <ResolveDialog
          title="Удалить контент"
          description="Контент будет удалён безвозвратно. Все открытые жалобы на него закроются."
          hint="Причина будет показана автору. Снимок содержимого и причина сохранятся в журнале."
          reasonRequired
          danger
          confirmLabel="Удалить"
          onClose={() => setDialog(null)}
          onConfirm={(reason) => finish("delete_content", reason)}
        />
      )}
      {dialog === "ban_author" && (
        <ResolveDialog
          title="Заблокировать автора"
          description={
            author?.bannedAt
              ? "Автор уже заблокирован: жалоба будет закрыта без повторной блокировки."
              : `@${author?.username} не сможет войти, все его сессии будут завершены. Жалоба будет закрыта.`
          }
          reasonRequired
          danger
          confirmLabel="Заблокировать"
          onClose={() => setDialog(null)}
          onConfirm={(reason) => finish("ban_author", reason)}
        />
      )}
      {dialog === "dismiss" && (
        <ResolveDialog
          title="Отклонить жалобу"
          description="Жалоба будет закрыта без действий над контентом и автором."
          hint="Причина будет показана пользователю при попытке войти."
          reasonRequired={false}
          confirmLabel="Отклонить"
          onClose={() => setDialog(null)}
          onConfirm={(reason) => finish("dismiss", reason)}
        />
      )}
    </div>
  );
}