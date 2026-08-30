import { api } from "./api";

export type UserSearchResult = {
  id: string;
  username: string;
  displayName: string | null;
};

export type PostSearchResult = {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

export async function search(
  q: string,
  type: "users" | "posts"
): Promise<UserSearchResult[] | PostSearchResult[]> {
  const res = await api.get(`/search?q=${encodeURIComponent(q)}&type=${type}`);
  if (!res.ok) throw new Error("Ошибка поиска");
  const data = await res.json();
  return data.results;
}