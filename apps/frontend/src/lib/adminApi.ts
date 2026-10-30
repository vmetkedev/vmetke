import { api } from "./api";
import type { UserRole } from "../auth/AuthContext";

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

export type AdminUserListItem = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  avatarColor: number | null;
  createdAt: string;
  bannedAt: string | null;
};

export type AdminUserDetail = AdminUserListItem & {
  bio: string | null;
  banReason: string | null;
  postsCount: number;
  commentsCount: number;
  lastActiveAt: string | null;
};

export type AdminUsersFilter = {
  q?: string;
  role?: UserRole | "";
  banned?: "true" | "false" | "";
};

async function errorFrom(res: Response, fallback: string): Promise<Error> {
  try {
    const data = await res.json();
    if (typeof data.error === "string") return new Error(data.error);
  } catch {
    // тело не JSON
  }
  return new Error(fallback);
}

async function ensureOk(res: Response, fallback: string) {
  if (!res.ok) throw await errorFrom(res, fallback);
}

export async function fetchAdminUsers(
  filter: AdminUsersFilter,
  cursor?: string,
): Promise<{ users: AdminUserListItem[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: "25" });
  if (filter.q) params.set("q", filter.q);
  if (filter.role) params.set("role", filter.role);
  if (filter.banned) params.set("banned", filter.banned);
  if (cursor) params.set("cursor", cursor);
  const res = await api.get(`/admin/users?${params}`);
  await ensureOk(res, "Не удалось загрузить пользователей");
  return res.json();
}

export async function fetchAdminUser(id: string): Promise<AdminUserDetail> {
  const res = await api.get(`/admin/users/${id}`);
  await ensureOk(res, "Не удалось загрузить пользователя");
  return (await res.json()).user;
}

export async function banAdminUser(id: string, reason: string) {
  await ensureOk(await api.post(`/admin/users/${id}/ban`, { reason }), "Не удалось заблокировать");
}

export async function unbanAdminUser(id: string) {
  await ensureOk(await api.post(`/admin/users/${id}/unban`), "Не удалось разблокировать");
}

export async function changeAdminUserRole(id: string, role: UserRole) {
  await ensureOk(await api.patch(`/admin/users/${id}/role`, { role }), "Не удалось сменить роль");
}

export async function forceLogoutAdminUser(id: string) {
  await ensureOk(await api.post(`/admin/users/${id}/logout`), "Не удалось завершить сессии");
}