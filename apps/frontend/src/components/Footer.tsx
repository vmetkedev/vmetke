import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";

export function Footer() {
  const { theme, setTheme } = useTheme();

  const options: { value: "light" | "dark" | "system"; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun size={16} />, label: "Светлая тема" },
    { value: "dark", icon: <Moon size={16} />, label: "Тёмная тема" },
    { value: "system", icon: <Monitor size={16} />, label: "Системная тема" },
  ];

  return (
    <footer className="border-t dark:border-gray-700 mt-8">
      <div className="max-w-2xl mx-auto px-8 py-6 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>© {new Date().getFullYear()} Vmetke</span>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              aria-label={opt.label}
              className={`p-1.5 rounded-full ${
                theme === opt.value
                  ? "bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-white"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              }`}
            >
              {opt.icon}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}