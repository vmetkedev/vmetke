import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1, "заголовок обязателен").max(200, "максимум 200 символов"),
  content: z.string().min(1, "пост не может быть пустым").max(55000, "максимум 55000 символов"),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(30, "тег: максимум 30 символов"))
    .max(5, "максимум 5 тегов")
    .transform((arr) => [...new Set(arr)])
    .default([]),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;

export const searchQuerySchema = z
  .object({
    q: z.string().min(1).max(100).optional(),
    type: z.enum(["users", "posts"]),
    tag: z.string().trim().toLowerCase().min(1).max(30).optional(),
    limit: z.coerce.number().int().min(1).max(30).default(15),
  })
  .superRefine((data, ctx) => {
    if (data.type === "users" && !data.q) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "q обязателен для поиска пользователей", path: ["q"] });
    }
    if (data.type === "posts" && !data.q && !data.tag) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "q или tag обязателен для поиска постов", path: ["q"] });
    }
  });

export type SearchQuery = z.infer<typeof searchQuerySchema>;