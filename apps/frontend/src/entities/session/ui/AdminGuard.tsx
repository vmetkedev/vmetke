import { Navigate, Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { isStaff } from "../auth/roles";

export function AdminGuard() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!isStaff(user)) return <Navigate to="/" replace />;
  return <Outlet />;
}