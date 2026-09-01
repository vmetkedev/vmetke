import { api } from "./api";

export type Post = {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  isLikedByMe: boolean;
  isBookmarkedByMe: boolean;
  author: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

export type FeedResponse = {
  posts: Post[];
  nextCursor: string | null;
};

export async function fetchFeed(cursor?: string): Promise<FeedResponse> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const res = await api.get(`/posts/feed${query}`);
  if (!res.ok) throw new Error("Не удалось загрузить ленту");
  return res.json();
}

export async function fetchPost(postId: string): Promise<Post> {
  const res = await api.get(`/posts/${postId}`);
  if (!res.ok) throw new Error("Пост не найден");
  const data = await res.json();
  return data.post;
}

export async function createPost(title: string, content: string): Promise<Post> {
  const res = await api.post("/posts", { title, content });
  if (!res.ok) throw new Error("Не удалось опубликовать пост");
  const data = await res.json();
  return data.post;
}

export async function updatePost(postId: string, title: string, content: string): Promise<Post> {
  const res = await api.patch(`/posts/${postId}`, { title, content });
  if (!res.ok) throw new Error("Не удалось отредактировать пост");
  const data = await res.json();
  return data.post;
}

export async function deletePost(postId: string) {
  const res = await api.delete(`/posts/${postId}`);
  if (!res.ok) throw new Error("Не удалось удалить пост");
}

export async function likePost(postId: string) {
  const res = await api.post(`/posts/${postId}/like`);
  if (!res.ok) throw new Error("Не удалось поставить лайк");
}

export async function unlikePost(postId: string) {
  const res = await api.delete(`/posts/${postId}/like`);
  if (!res.ok) throw new Error("Не удалось убрать лайк");
}

export async function deleteComment(commentId: string) {
  const res = await api.delete(`/posts/comments/${commentId}`);
  if (!res.ok) throw new Error("Не удалось удалить комментарий");
}

export type Comment = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
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

export async function bookmarkPost(postId: string) {
  const res = await api.post(`/posts/${postId}/bookmark`);
  if (!res.ok) throw new Error("Не удалось добавить в избранное");
}

export async function unbookmarkPost(postId: string) {
  const res = await api.delete(`/posts/${postId}/bookmark`);
  if (!res.ok) throw new Error("Не удалось убрать из избранного");
}

export async function fetchBookmarks(cursor?: string): Promise<FeedResponse> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const res = await api.get(`/posts/bookmarks${query}`);
  if (!res.ok) throw new Error("Не удалось загрузить закладки");
  return res.json();
}