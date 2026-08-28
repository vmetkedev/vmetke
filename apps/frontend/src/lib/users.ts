import { api } from "./api";
import type { Post } from "./posts";

export type UserProfile = {
  id: string;
  username: string;
  displayName: string | null;
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

export async function fetchUserPosts(
  username: string,
  cursor?: string
): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const res = await api.get(`/users/${encodeURIComponent(username)}/posts${query}`);
  if (!res.ok) throw new Error("Не удалось загрузить посты");
  return res.json();
}

export async function followUser(userId: string) {
  const res = await api.post(`/follows/${userId}`);
  if (!res.ok) throw new Error("Не удалось подписаться");
}

export async function unfollowUser(userId: string) {
  const res = await api.delete(`/follows/${userId}`);
  if (!res.ok) throw new Error("Не удалось отписаться");
}