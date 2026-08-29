import { api } from "./api";

export type Notification = {
  id: string;
  type: "like" | "comment" | "follow";
  postId: string | null;
  read: boolean;
  createdAt: string;
  actor: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

export async function fetchNotifications(): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const res = await api.get("/notifications");
  if (!res.ok) throw new Error("Не удалось загрузить уведомления");
  return res.json();
}

export async function markNotificationsRead() {
  const res = await api.post("/notifications/read");
  if (!res.ok) throw new Error("Не удалось отметить как прочитанное");
}

export async function deleteNotification(id: string) {
  const res = await api.delete(`/notifications/${id}`);
  if (!res.ok) throw new Error("Не удалось удалить уведомление");
}