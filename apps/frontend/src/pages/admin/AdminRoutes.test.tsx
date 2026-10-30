import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import AdminRoutes from "./AdminRoutes";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

vi.mock("../../components/AppLayout", () => {
  const AppLayout = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return { AppLayout, default: AppLayout };
});

function renderAt(path: string, role: "moderator" | "admin") {
  mockUseAuth.mockReturnValue({
    user: { id: "1", username: "u", avatarColor: null, role },
    loading: false,
  });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<AdminRoutes />} />
      </Routes>
    </MemoryRouter>,
  );
}

const heading = (name: string) => screen.getByRole("heading", { name });

describe("AdminRoutes: меню", () => {
  it("админ видит все пять разделов", () => {
    renderAt("/admin", "admin");
    for (const name of ["Обзор", "Пользователи", "Контент", "Жалобы", "Журнал"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("модератор не видит «Пользователи» и «Журнал»", () => {
    renderAt("/admin", "moderator");
    expect(screen.getByRole("link", { name: "Контент" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Жалобы" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Пользователи" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Журнал" })).not.toBeInTheDocument();
  });
});

describe("AdminRoutes: маршруты", () => {
  it("/admin показывает «Обзор»", () => {
    renderAt("/admin", "admin");
    expect(heading("Обзор")).toBeInTheDocument();
  });

  it("админ открывает /admin/users", () => {
    renderAt("/admin/users", "admin");
    expect(heading("Пользователи")).toBeInTheDocument();
  });

  it("модератора с /admin/users возвращает на «Обзор»", () => {
    renderAt("/admin/users", "moderator");
    expect(heading("Обзор")).toBeInTheDocument();
  });

  it("модератора с /admin/audit возвращает на «Обзор»", () => {
    renderAt("/admin/audit", "moderator");
    expect(heading("Обзор")).toBeInTheDocument();
  });

  it("неизвестный подпуть ведёт на «Обзор»", () => {
    renderAt("/admin/nonsense", "admin");
    expect(heading("Обзор")).toBeInTheDocument();
  });
});