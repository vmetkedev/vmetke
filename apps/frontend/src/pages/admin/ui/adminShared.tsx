import type { UserRole } from "@/entities/session";
import { useEffect, useState } from "react";
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from "@/entities/report";
import type { ReportStatus } from "@/features/admin";

export const reasonLabel = (r: ReportReason) => REPORT_REASONS.find((x) => x.id === r)?.label ?? r;

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "Пользователь",
  moderator: "Модератор",
  admin: "Администратор",
};

export const TARGET_LABELS: Record<ReportTargetType, string> = {
  post: "Пост",
  comment: "Комментарий",
  user: "Пользователь",
  message: "Сообщение",
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Открыта",
  resolved: "Решена",
  dismissed: "Отклонена",
};

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" }) : "—";

export function RoleBadge({ role }: { role: UserRole }) {
  if (role === "user") return null;
  const cls =
    role === "admin"
      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  return <span className={`text-[11px] px-1.5 py-0.5 rounded ${cls}`}>{ROLE_LABELS[role]}</span>;
}

export function BannedBadge() {
  return (
    <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
      Заблокирован
    </span>
  );
}

export const BTN =
  "px-3 py-1.5 text-sm rounded-md border dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700";
export const BTN_DANGER = "px-3 py-1.5 text-sm rounded-md bg-red-600 text-white disabled:opacity-50";

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export const DELETE_FORBIDDEN_HINT = "Контент модераторов и администраторов удаляет только администратор";

export function canDeleteContent(
  me: { id: string; role: UserRole } | null,
  author: { id: string; role: UserRole },
) {
  if (!me) return false;
  return me.role === "admin" || author.role === "user" || author.id === me.id;
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  const cls =
    status === "open"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : status === "resolved"
        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  return <span className={`text-[11px] px-1.5 py-0.5 rounded ${cls}`}>{STATUS_LABELS[status]}</span>;
}

export const ACTION_LABELS: Record<string, string> = {
  "role.grant": "Выдача роли",
  "role.change": "Смена роли",
  "user.ban": "Блокировка",
  "user.unban": "Разблокировка",
  "user.force_logout": "Принудительный выход",
  "post.delete": "Удаление поста",
  "comment.delete": "Удаление комментария",
  "report.resolve": "Жалоба решена",
  "report.dismiss": "Жалоба отклонена",
  "user.delete": "Удаление пользователя",
  "admin.reauth_failed": "Неверный пароль при подтверждении",
};

export const AUDIT_TARGET_LABELS: Record<string, string> = {
  user: "Пользователь",
  post: "Пост",
  comment: "Комментарий",
  report: "Жалоба",
};