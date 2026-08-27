import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "минимум 8 символов")
    .max(72)
    .regex(/[.!@$#%^&*\-_=+]/, "должен содержать хотя бы один спецсимвол: . ! @ $ # % ^ & * - _ = +"),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "только латиница, цифры и подчёркивание"),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Введите email или имя пользователя"),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;