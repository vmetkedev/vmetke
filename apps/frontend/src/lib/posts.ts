import { api } from "./api";

export type Post = {
  id: string;
  content: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
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

export async function createPost(content: string): Promise<Post> {
  const res = await api.post("/posts", { content });
  if (!res.ok) throw new Error("Не удалось опубликовать пост");
  const data = await res.json();
  return data.post;
}

export async function likePost(postId: string) {
  const res = await api.post(`/posts/${postId}/like`);
  if (!res.ok) throw new Error("Не удалось поставить лайк");
}

export async function unlikePost(postId: string) {
  const res = await api.delete(`/posts/${postId}/like`);
  if (!res.ok) throw new Error("Не удалось убрать лайк");
}

export type Comment = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
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