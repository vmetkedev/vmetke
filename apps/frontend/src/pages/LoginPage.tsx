import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { FieldHint } from "../components/FieldHint";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(identifier, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 system-dark:bg-gray-900">
      <form onSubmit={handleSubmit} className="bg-white system-dark:bg-gray-800 p-8 rounded-lg shadow w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold system-dark:text-gray-100">Вход в vmetke</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="relative">
          <input
            type="text"
            placeholder="Email или имя пользователя"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full border system-dark:border-gray-600 system-dark:bg-gray-700 system-dark:text-gray-100 rounded px-3 py-2 pr-10"
            required
          />
          <FieldHint
            text="Email или имя пользователя, указанные при регистрации"
            className="absolute right-2 top-1/2 -translate-y-1/2"
          />
        </div>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border system-dark:border-gray-600 system-dark:bg-gray-700 system-dark:text-gray-100 rounded px-3 py-2 pr-16"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-9 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            tabIndex={-1}
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          <FieldHint
            text="Мин. 8 символов, один спецсимвол: . ! @ $ # % ^ & * - _ = +"
            className="absolute right-2 top-1/2 -translate-y-1/2"
          />
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white rounded py-2">
          Войти
        </button>
        <p className="text-sm text-center system-dark:text-gray-300">
          Нет аккаунта? <Link to="/register" className="text-blue-600 system-dark:text-blue-400">Зарегистрироваться</Link>
        </p>
      </form>
    </div>
  );
}