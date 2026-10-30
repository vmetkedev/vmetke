import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminUserPage } from "./AdminUserPage";

const api = vi.hoisted(() => ({
  fetchAdminUser: vi.fn(),
  banAdminUser: vi.fn(),
  unbanAdminUser: vi.fn(),
  changeAdminUserRole: vi.fn(),
  forceLogoutAdminUser: vi.fn(),
}));
vi.mock("../../lib/adminApi", () => api);

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

const USER = {
  id: "u1",
  username: "alice",
  email: "alice@example.com",
  displayName: "Alice",
  bio: null,
  role: "user" as const,
  avatarColor: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  bannedAt: null,
  banReason: null,
  postsCount: 3,
  commentsCount: 7,
  lastActiveAt: "2026-10-29T10:00:00.000Z",
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin/users/u1"]}>
        <Routes>
          <Route path="/admin/users/:id" element={<AdminUserPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.fetchAdminUser.mockResolvedValue(USER);
  mockUseAuth.mockReturnValue({ user: { id: "me", username: "root", avatarColor: null, role: "admin" } });
});

describe("AdminUserPage", () => {
  it("показывает профиль и счётчики", async () => {
    renderPage();
    expect(await screen.findByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("бан: кнопка неактивна без причины, затем отправляет причину", async () => {
    api.banAdminUser.mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Заблокировать" }));

    const dialog = screen.getByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Заблокировать" });
    expect(submit).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText("Причина"), "  спам  ");
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    expect(api.banAdminUser).toHaveBeenCalledWith("u1", "спам");
  });

  it("показывает ошибку сервера в диалоге", async () => {
    api.banAdminUser.mockRejectedValue(new Error("Пользователь уже заблокирован"));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Заблокировать" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Причина"), "спам");
    await userEvent.click(within(dialog).getByRole("button", { name: "Заблокировать" }));
    expect(await within(dialog).findByText("Пользователь уже заблокирован")).toBeInTheDocument();
  });

  it("заблокированному доступен разбан и видна причина", async () => {
    api.fetchAdminUser.mockResolvedValue({ ...USER, bannedAt: "2026-10-02T10:00:00.000Z", banReason: "спам" });
    api.unbanAdminUser.mockResolvedValue(undefined);
    renderPage();
    expect(await screen.findByText(/спам/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Заблокировать" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Разблокировать" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Разблокировать" }));
    expect(api.unbanAdminUser).toHaveBeenCalledWith("u1");
  });

  it("смена роли отправляет выбранную роль", async () => {
    api.changeAdminUserRole.mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Сменить роль" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Новая роль"), "moderator");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сменить роль" }));
    expect(api.changeAdminUserRole).toHaveBeenCalledWith("u1", "moderator");
  });

  it("принудительный выход вызывает API", async () => {
    api.forceLogoutAdminUser.mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Завершить все сессии" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Завершить сессии" }));
    expect(api.forceLogoutAdminUser).toHaveBeenCalledWith("u1");
  });

  it("над собой действий нет", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1", username: "alice", avatarColor: null, role: "admin" } });
    renderPage();
    await screen.findByText("@alice");
    expect(screen.getByText(/Это вы/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Заблокировать" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сменить роль" })).not.toBeInTheDocument();
  });
});