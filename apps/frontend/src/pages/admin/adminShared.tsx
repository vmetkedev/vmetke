import type { UserRole } from "../../auth/AuthContext";
import { useEffect, useState } from "react";

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "Пользователь",
  moderator: "Модератор",
  admin: "Администратор",
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