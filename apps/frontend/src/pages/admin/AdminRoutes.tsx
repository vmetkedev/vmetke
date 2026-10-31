import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { AdminLayout } from "./AdminLayout";
import { AdminPlaceholder } from "./AdminPlaceholder";
import { AdminOverviewPage } from "./AdminOverviewPage";
import { AdminUsersPage } from "./AdminUsersPage";
import { AdminUserPage } from "./AdminUserPage";
import { AdminContentPage } from "./AdminContentPage";

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="users" element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
        <Route path="users/:id" element={<RequireAdmin><AdminUserPage /></RequireAdmin>} />
        <Route path="content" element={<AdminContentPage />} />
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