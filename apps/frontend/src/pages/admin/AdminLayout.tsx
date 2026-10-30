import { NavLink, Outlet } from "react-router";
import { LayoutDashboard, Users, FileText, Flag, ScrollText } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { AppLayout } from "../../components/AppLayout";

const NAV = [
  { to: "/admin", label: "Обзор", icon: LayoutDashboard, end: true, adminOnly: false },
  { to: "/admin/users", label: "Пользователи", icon: Users, end: false, adminOnly: true },
  { to: "/admin/content", label: "Контент", icon: FileText, end: false, adminOnly: false },
  { to: "/admin/reports", label: "Жалобы", icon: Flag, end: false, adminOnly: false },
  { to: "/admin/audit", label: "Журнал", icon: ScrollText, end: false, adminOnly: true },
];

export function AdminLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-8 flex flex-col md:flex-row gap-6">
        <aside className="md:w-52 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto" aria-label="Разделы админки">
            {NAV.filter((item) => isAdmin || !item.adminOnly).map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap ${
                    isActive
                      ? "bg-gray-200 dark:bg-gray-700 font-medium dark:text-gray-100"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </AppLayout>
  );
}