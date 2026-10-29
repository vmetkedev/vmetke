import type { User } from "./AuthContext";

export const isStaff = (user: User | null) =>
  user?.role === "moderator" || user?.role === "admin";