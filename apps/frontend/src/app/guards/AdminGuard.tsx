import { Navigate, Outlet } from "react-router";
import { isStaff, useAuth } from "@/entities/session";

export function AdminGuard() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!isStaff(user)) return <Navigate to="/" replace />;
  return <Outlet />;
}