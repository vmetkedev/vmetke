import { z } from "zod";

export const createPostSchema = z.object({
  content: z.string().min(1, "пост не может быть пустым").max(2000, "максимум 2000 символов"),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;