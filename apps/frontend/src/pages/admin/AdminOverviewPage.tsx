import { useQuery } from "@tanstack/react-query";
import { fetchAdminStats } from "../../lib/adminApi";

const fmt = (n: number) => n.toLocaleString("ru-RU");

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 px-4 py-3">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold dark:text-gray-100">{fmt(value)}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{children}</div>
    </section>
  );
}

export function AdminOverviewPage() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: fetchAdminStats,
    staleTime: 30_000,
  });

  return (
    <div>
      <h1 className="text-xl font-semibold dark:text-gray-100">Обзор</h1>

      {isPending && <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>}

      {isError && (
        <div className="mt-4 text-sm">
          <p className="text-red-600 dark:text-red-400">Не удалось загрузить статистику</p>
          <button onClick={() => refetch()} className="mt-2 underline dark:text-gray-200">
            Повторить
          </button>
        </div>
      )}

      {data && (
        <>
          <Section title="Пользователи">
            <StatCard label="Всего" value={data.users.total} />
            <StatCard label="За 24 часа" value={data.users.last24h} />
            <StatCard label="За 7 дней" value={data.users.last7d} />
          </Section>
          <Section title="Контент">
            <StatCard label="Постов" value={data.posts} />
            <StatCard label="Комментариев" value={data.comments} />
          </Section>
          <Section title="Сообщения">
            <StatCard label="Диалогов" value={data.conversations} />
            <StatCard label="Сообщений" value={data.messages} />
          </Section>
          <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
            Обновлено: {new Date(data.generatedAt).toLocaleTimeString("ru-RU")} (данные кэшируются на 60 с)
          </p>
        </>
      )}
    </div>
  );
}