import type { UserRole } from "../../auth/AuthContext";

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