export function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold dark:text-gray-100">{title}</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Раздел в разработке.</p>
    </div>
  );
}