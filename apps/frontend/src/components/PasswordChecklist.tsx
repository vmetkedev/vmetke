const RULES = [
  { label: "минимум 8 символов", test: (p: string) => p.length >= 8 },
  { label: "спецсимвол: . ! @ $ # % ^ & * - _ = +", test: (p: string) => /[.!@$#%^&*\-_=+]/.test(p) },
];

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="text-xs space-y-0.5 mt-1.5">
      {RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.label} className={ok ? "text-green-600" : "text-gray-400"}>
            {ok ? "✓" : "○"} {rule.label}
          </li>
        );
      })}
    </ul>
  );
}