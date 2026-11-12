import { api } from "./api";

export async function deleteAccount(password: string): Promise<void> {
  const res = await api.delete("/users/me", { password });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Неверный пароль");
    throw new Error("Не удалось удалить аккаунт");
  }
}