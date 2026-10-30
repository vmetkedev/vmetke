import { api } from "./api";

export type AdminStats = {
  users: { total: number; last24h: number; last7d: number };
  posts: number;
  comments: number;
  conversations: number;
  messages: number;
  generatedAt: string;
};

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await api.get("/admin/stats");
  if (!res.ok) throw new Error("Не удалось загрузить статистику");
  return res.json();
}