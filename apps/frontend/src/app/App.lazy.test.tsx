import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "./App";

// Eager-страницы и обёртки, чтобы не тянуть всё приложение
vi.mock("@/pages/login/ui/LoginPage", () => ({ default: () => <h1>login-page</h1> }));
vi.mock("@/pages/register/ui/RegisterPage", () => ({ default: () => <h1>register-page</h1> }));
vi.mock("@/pages/feed/ui/FeedPage", () => ({ default: () => <h1>feed-page</h1> }));
vi.mock("./guards/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./guards/AdminGuard", async () => {
  const { Outlet } = await import("react-router");
  return { AdminGuard: () => <Outlet /> };
});
// Ленивые страницы, которые проверяем
vi.mock("@/pages/settings/ui/SettingsPage", () => ({ default: () => <h1>settings-page</h1> }));
vi.mock("@/pages/help/ui/MarkdownHelpPage", () => ({ default: () => <h1>markdown-help-page</h1> }));
vi.mock("@/pages/admin/ui/AdminRoutes", () => ({ default: () => <h1>admin-routes</h1> }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

describe("App: маршруты и ленивая загрузка", () => {
  it("главная (eager) рендерится сразу", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { name: "feed-page" })).toBeInTheDocument();
  });

  it("ленивая страница: сначала заглушка, затем страница", async () => {
    renderAt("/settings");
    expect(screen.getByText("Загрузка…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "settings-page" })).toBeInTheDocument();
  });

  it("публичная ленивая страница справки", async () => {
    renderAt("/docs/help/markdown");
    expect(await screen.findByRole("heading", { name: "markdown-help-page" })).toBeInTheDocument();
  });

  it("админка грузится лениво под AdminGuard", async () => {
    renderAt("/admin/users");
    expect(await screen.findByRole("heading", { name: "admin-routes" })).toBeInTheDocument();
  });
});