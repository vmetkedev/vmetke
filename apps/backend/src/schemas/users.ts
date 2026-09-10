import { z } from "zod";

export const updateAvatarSchema = z.object({
  avatarColor: z.number().int().min(0).max(9, "Некорректный индекс цвета"),
});

export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;