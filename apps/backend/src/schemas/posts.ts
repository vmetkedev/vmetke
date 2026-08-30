import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1, "заголовок обязателен").max(200, "максимум 200 символов"),
  content: z.string().min(1, "пост не может быть пустым").max(30000, "максимум 30000 символов"),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(["users", "posts"]),
  limit: z.coerce.number().int().min(1).max(30).default(15),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;