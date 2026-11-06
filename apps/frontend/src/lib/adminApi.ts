import { api } from "./api";
import type { UserRole } from "../auth/AuthContext";
import type { ReportReason, ReportTargetType } from "./reports";

export type AdminContentFilter = { q?: string; author?: string; from?: string; to?: string };
export type AdminContentAuthor = { id: string; username: string; avatarColor: number | null; role: UserRole };
export type AdminReportsFilter = { status: ReportStatus | "all"; targetType: ReportTargetType | "" };

export type ReportStatus = "open" | "resolved" | "dismissed";
export type ReportAction = "delete_content" | "ban_author" | "dismiss";
export type ReportResolution = "content_deleted" | "author_banned" | "dismissed";

export type AdminStats = {
  users: { total: number; last24h: number; last7d: number };
  posts: number;
  comments: number;
  conversations: number;
  messages: number;
  generatedAt: string;
};

export type AdminPostListItem = {
  id: string;
  title: string | null;
  excerpt: string;
  tags: string[];
  views: number;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  author: AdminContentAuthor;
};
export type AdminPostDetail = Omit<AdminPostListItem, "excerpt"> & { content: string };
export type AdminCommentListItem = {
  id: string;
  content: string;
  createdAt: string;
  author: AdminContentAuthor;
  post: { id: string; title: string | null };
};

export type AdminReportListItem = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  comment: string | null;
  status: ReportStatus;
  createdAt: string;
  preview: string;
  reporter: { id: string; username: string } | null;
  targetUser: { id: string; username: string; role: UserRole } | null;
};

export type AdminReportDetail = Omit<AdminReportListItem, "preview" | "targetUser"> & {
  snapshot: Record<string, unknown>;
  resolvedAt: string | null;
  resolutionAction: ReportResolution | null;
  resolutionReason: string | null;
  targetUser: {
    id: string;
    username: string;
    role: UserRole;
    bannedAt: string | null;
    deletedAt: string | null;
  } | null;
  resolvedBy: { id: string; username: string } | null;
  openReportsForTarget: number;
  contentExists: boolean;
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

export async function changeAdminUserRole(id: string, role: UserRole, password: string) {
  await ensureOk(await api.patch(`/admin/users/${id}/role`, { role, password }), "Не удалось сменить роль");
}

export async function deleteAdminUser(id: string, password: string, reason: string) {
  await ensureOk(await api.delete(`/admin/users/${id}`, { password, reason }), "Не удалось удалить пользователя");
}

export async function forceLogoutAdminUser(id: string) {
  await ensureOk(await api.post(`/admin/users/${id}/logout`), "Не удалось завершить сессии");
}

function contentQuery(filter: AdminContentFilter, cursor?: string) {
  const params = new URLSearchParams({ limit: "25" });
  if (filter.q) params.set("q", filter.q);
  if (filter.author) params.set("author", filter.author);
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

export async function fetchAdminPosts(
  filter: AdminContentFilter,
  cursor?: string,
): Promise<{ posts: AdminPostListItem[]; nextCursor: string | null }> {
  const res = await api.get(`/admin/content/posts?${contentQuery(filter, cursor)}`);
  await ensureOk(res, "Не удалось загрузить посты");
  return res.json();
}

export async function fetchAdminPost(id: string): Promise<AdminPostDetail> {
  const res = await api.get(`/admin/content/posts/${id}`);
  await ensureOk(res, "Не удалось загрузить пост");
  return (await res.json()).post;
}

export async function deleteAdminPost(id: string, reason: string) {
  await ensureOk(await api.delete(`/admin/content/posts/${id}`, { reason }), "Не удалось удалить пост");
}

export async function fetchAdminComments(
  filter: AdminContentFilter,
  cursor?: string,
): Promise<{ comments: AdminCommentListItem[]; nextCursor: string | null }> {
  const res = await api.get(`/admin/content/comments?${contentQuery(filter, cursor)}`);
  await ensureOk(res, "Не удалось загрузить комментарии");
  return res.json();
}

export async function deleteAdminComment(id: string, reason: string) {
  await ensureOk(await api.delete(`/admin/content/comments/${id}`, { reason }), "Не удалось удалить комментарий");
}

export async function fetchAdminReports(
  filter: AdminReportsFilter,
  cursor?: string,
): Promise<{ reports: AdminReportListItem[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: "25", status: filter.status });
  if (filter.targetType) params.set("targetType", filter.targetType);
  if (cursor) params.set("cursor", cursor);
  const res = await api.get(`/admin/reports?${params}`);
  await ensureOk(res, "Не удалось загрузить жалобы");
  return res.json();
}

export async function fetchAdminReport(id: string): Promise<AdminReportDetail> {
  const res = await api.get(`/admin/reports/${id}`);
  await ensureOk(res, "Не удалось загрузить жалобу");
  return (await res.json()).report;
}

export async function resolveAdminReport(id: string, action: ReportAction, reason?: string) {
  const res = await api.post(`/admin/reports/${id}/resolve`, { action, reason: reason?.trim() || undefined });
  await ensureOk(res, "Не удалось обработать жалобу");
}

export type AdminAuditFilter = {
  admin?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
};

export type AdminAuditItem = {
  id: number;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
  admin: { id: string; username: string } | null;
  reason: string | null;
  targetLabel: string | null;
};

export type AdminAuditDetail = Omit<AdminAuditItem, "reason" | "targetLabel"> & {
  details: Record<string, unknown> | null;
};

export async function fetchAdminAudit(
  filter: AdminAuditFilter,
  cursor?: number,
): Promise<{ entries: AdminAuditItem[]; nextCursor: number | null }> {
  const params = new URLSearchParams({ limit: "25" });
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, value);
  }
  if (cursor) params.set("cursor", String(cursor));
  const res = await api.get(`/admin/audit?${params}`);
  await ensureOk(res, "Не удалось загрузить журнал");
  return res.json();
}

export async function fetchAdminAuditEntry(id: number): Promise<AdminAuditDetail> {
  const res = await api.get(`/admin/audit/${id}`);
  await ensureOk(res, "Не удалось загрузить запись");
  return (await res.json()).entry;
}

export async function fetchAdminOpenReportsCount(): Promise<number> {
  const res = await api.get("/admin/reports/open-count");
  await ensureOk(res, "Не удалось загрузить счётчик жалоб");
  return (await res.json()).count;
}