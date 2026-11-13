import { Navigate, Outlet } from "react-router";
import { useAuth } from "../model/AuthContext";
import { isStaff } from "../model/roles";

export function AdminGuard() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!isStaff(user)) return <Navigate to="/" replace />;
  return <Outlet />;
}