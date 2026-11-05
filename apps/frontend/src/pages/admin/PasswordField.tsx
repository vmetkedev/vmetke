export function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="mt-3 block text-sm dark:text-gray-200">
      Ваш пароль
      <input
        type="password"
        autoComplete="current-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
      />
    </label>
  );
}