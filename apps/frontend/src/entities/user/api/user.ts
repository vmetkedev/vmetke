import { api } from "@/shared/api/client";

export type UserProfile = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarColor: number | null;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  isFollowedByMe: boolean;
  isMe: boolean;
};

export async function fetchUserProfile(username: string): Promise<UserProfile> {
  const res = await api.get(`/users/${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error("Пользователь не найден");
  const data = await res.json();
  return data.user;
}

export async function followUser(userId: string) {
  const res = await api.post(`/follows/${userId}`);
  if (!res.ok) throw new Error("Не удалось подписаться");
}

export async function unfollowUser(userId: string) {
  const res = await api.delete(`/follows/${userId}`);
  if (!res.ok) throw new Error("Не удалось отписаться");
}

export async function updateAvatarColor(avatarColor: number) {
  const res = await api.patch("/users/me/avatar", { avatarColor });
  if (!res.ok) throw new Error("Не удалось обновить аватар");
}