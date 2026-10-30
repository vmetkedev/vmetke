import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { AdminLayout } from "./AdminLayout";
import { AdminPlaceholder } from "./AdminPlaceholder";

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminPlaceholder title="Обзор" />} />
        <Route
          path="users"
          element={<RequireAdmin><AdminPlaceholder title="Пользователи" /></RequireAdmin>}
        />
        <Route path="content" element={<AdminPlaceholder title="Контент" />} />
        <Route path="reports" element={<AdminPlaceholder title="Жалобы" />} />
        <Route
          path="audit"
          element={<RequireAdmin><AdminPlaceholder title="Журнал" /></RequireAdmin>}
        />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}