import { useQuery } from "@tanstack/react-query";
import { fetchAdminOpenReportsCount } from "../api/admin";

export function ReportsBadge() {
  const { data } = useQuery({
    queryKey: ["admin", "reports", "open-count"],
    queryFn: fetchAdminOpenReportsCount,
    refetchInterval: 60_000,
  });
  if (!data) return null; // 0, ошибка и загрузка: бейджа нет

  return (
    <span
      aria-label={`Открытых жалоб: ${data}`}
      className="ml-auto bg-red-500 text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center"
    >
      {data > 99 ? "99+" : data}
    </span>
  );
}