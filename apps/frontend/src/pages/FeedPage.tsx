import { useAuth } from "../auth/AuthContext";

export default function FeedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">Привет, {user?.username}</h1>
        <button onClick={logout} className="text-sm text-gray-500">
          Выйти
        </button>
      </div>
      <p className="text-gray-500">Здесь появится лента постов (Фаза 7).</p>
    </div>
  );
}