import { api } from "./api";

export type Post = {
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