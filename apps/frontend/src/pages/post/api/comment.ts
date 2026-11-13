import { api } from "@/shared/api";

export type Comment = {
  id: string;
  content: string;
  createdAt: string;
  likesCount: number;
  isLikedByMe: boolean;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarColor: number | null;
  };
};

export async function fetchComments(postId: string): Promise<Comment[]> {
  const res = await api.get(`/posts/${postId}/comments`);
  if (!res.ok) throw new Error("Не удалось загрузить комментарии");
  const data = await res.json();
  return data.comments;
}

export async function createComment(postId: string, content: string): Promise<Comment> {
  const res = await api.post(`/posts/${postId}/comments`, { content });
  if (!res.ok) throw new Error("Не удалось отправить комментарий");
  const data = await res.json();
  return data.comment;
}

export async function deleteComment(commentId: string) {
  const res = await api.delete(`/posts/comments/${commentId}`);
  if (!res.ok) throw new Error("Не удалось удалить комментарий");
}

export async function likeComment(commentId: string) {
  const res = await api.post(`/posts/comments/${commentId}/like`);
  if (!res.ok) throw new Error("Не удалось поставить лайк");
}

export async function unlikeComment(commentId: string) {
  const res = await api.delete(`/posts/comments/${commentId}/like`);
  if (!res.ok) throw new Error("Не удалось убрать лайк");
}