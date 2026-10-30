import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminUsersPage } from "./AdminUsersPage";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock("../../lib/adminApi", () => ({ fetchAdminUsers: mockFetch }));

const item = (id: string, username: string, extra = {}) => ({
  id,
  username,
  email: `${username}@example.com`,
  displayName: null,
  role: "user" as const,
  avatarColor: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  bannedAt: null,
  ...extra,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => mockFetch.mockReset());

describe("AdminUsersPage", () => {
  it("показывает список со ссылками на карточки", async () => {
    mockFetch.mockResolvedValue({ users: [item("u1", "alice"), item("u2", "bob")], nextCursor: null });
    renderPage();
    expect(await screen.findByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /@bob/ })).toHaveAttribute("href", "/admin/users/u2");
  });

  it("помечает заблокированных", async () => {
    mockFetch.mockResolvedValue({
      users: [item("u1", "alice", { bannedAt: "2026-10-02T10:00:00.000Z" })],
      nextCursor: null,
    });
    renderPage();
    expect(await screen.findByText("Заблокирован")).toBeInTheDocument();
  });

  it("пустой результат", async () => {
    mockFetch.mockResolvedValue({ users: [], nextCursor: null });
    renderPage();
    expect(await screen.findByText("Никого не найдено")).toBeInTheDocument();
  });

  it("поиск уходит на бэкенд с задержкой", async () => {
    mockFetch.mockResolvedValue({ users: [], nextCursor: null });
    renderPage();
    await screen.findByText("Никого не найдено");
    await userEvent.type(screen.getByLabelText("Поиск"), "ali");
    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith(expect.objectContaining({ q: "ali" }), undefined),
    );
  });

  it("фильтры роли и блокировки уходят на бэкенд", async () => {
    mockFetch.mockResolvedValue({ users: [], nextCursor: null });
    renderPage();
    await screen.findByText("Никого не найдено");
    await userEvent.selectOptions(screen.getByLabelText("Роль"), "moderator");
    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith(expect.objectContaining({ role: "moderator" }), undefined),
    );
    await userEvent.selectOptions(screen.getByLabelText("Блокировка"), "true");
    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.objectContaining({ role: "moderator", banned: "true" }),
        undefined,
      ),
    );
  });

  it("«Показать ещё» подгружает следующую страницу по курсору", async () => {
    mockFetch
      .mockResolvedValueOnce({ users: [item("u1", "alice")], nextCursor: "u1" })
      .mockResolvedValueOnce({ users: [item("u2", "bob")], nextCursor: null });
    renderPage();
    await screen.findByText("@alice");
    await userEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    expect(await screen.findByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenLastCalledWith(expect.anything(), "u1");
    expect(screen.queryByRole("button", { name: "Показать ещё" })).not.toBeInTheDocument();
  });
});