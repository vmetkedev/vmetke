import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, setAccessToken } from "../lib/api";

type User = { id: string; username: string };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const res = await api.post("/auth/refresh");
        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.accessToken);

          const meRes = await api.get("/auth/me");
          if (meRes.ok) {
            const meData = await meRes.json();
            setUser(meData.user);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);


  const login = async (identifier: string, password: string) => {
    const res = await api.post("/auth/login", { identifier, password });
    if (!res.ok) throw new Error("Неверные данные для входа");
    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const register = async (email: string, password: string, username: string) => {
    const res = await api.post("/auth/register", { email, password, username });
    if (!res.ok) throw new Error("Ошибка регистрации");
    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}