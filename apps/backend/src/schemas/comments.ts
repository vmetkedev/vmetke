import { z } from "zod";

export const createCommentSchema = z.object({
  content: z.string().min(1, "комментарий не может быть пустым").max(1000, "максимум 1000 символов"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;