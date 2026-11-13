import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminReportsPage } from "./AdminReportsPage";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock("@/features/admin", () => ({ fetchAdminReports: mockFetch }));

const item = (id: string, extra = {}) => ({
  id,
  targetType: "post" as const,
  targetId: "p1",
  reason: "spam" as const,
  comment: null,
  status: "open" as const,
  createdAt: "2026-10-01T10:00:00.000Z",
  preview: "Текст нарушающего поста",
  reporter: { id: "u9", username: "rita" },
  targetUser: { id: "u2", username: "bob", role: "user" as const },
  ...extra,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => mockFetch.mockReset());

describe("AdminReportsPage", () => {
  it("по умолчанию грузит открытые, показывает тип, причину, предпросмотр и участников", async () => {
    mockFetch.mockResolvedValue({ reports: [item("r1")], nextCursor: null });
    renderPage();

    expect(await screen.findByText("Текст нарушающего поста")).toBeInTheDocument();
    expect(screen.getByText("Пост")).toBeInTheDocument();
    expect(screen.getByText("Спам или реклама")).toBeInTheDocument();
    expect(screen.getByText("Открыта")).toBeInTheDocument();
    expect(screen.getByText(/От: @rita/)).toBeInTheDocument();
    expect(screen.getByText(/На: @bob/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Текст нарушающего поста/ })).toHaveAttribute("href", "/admin/reports/r1");
    expect(mockFetch).toHaveBeenCalledWith({ status: "open", targetType: "" }, undefined);
  });

  it("удалённые пользователи подписаны", async () => {
    mockFetch.mockResolvedValue({
      reports: [item("r1", { reporter: null, targetUser: null })],
      nextCursor: null,
    });
    renderPage();
    expect(await screen.findByText(/От: удалённый пользователь/)).toBeInTheDocument();
    expect(screen.getByText(/На: удалённый пользователь/)).toBeInTheDocument();
  });

  it("фильтры статуса и типа уходят на бэкенд", async () => {
    mockFetch.mockResolvedValue({ reports: [], nextCursor: null });
    renderPage();
    await screen.findByText("Жалоб нет");

    await userEvent.selectOptions(screen.getByLabelText("Статус"), "all");
    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith({ status: "all", targetType: "" }, undefined),
    );
    await userEvent.selectOptions(screen.getByLabelText("Тип"), "message");
    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith({ status: "all", targetType: "message" }, undefined),
    );
  });

  it("«Показать ещё» подгружает следующую страницу по курсору", async () => {
    mockFetch
      .mockResolvedValueOnce({ reports: [item("r1")], nextCursor: "r1" })
      .mockResolvedValueOnce({
        reports: [item("r2", { preview: "Второй предпросмотр" })],
        nextCursor: null,
      });
    renderPage();
    await screen.findByText("Текст нарушающего поста");
    await userEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    expect(await screen.findByText("Второй предпросмотр")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenLastCalledWith(expect.anything(), "r1");
    expect(screen.queryByRole("button", { name: "Показать ещё" })).not.toBeInTheDocument();
  });

  it("пустая очередь", async () => {
    mockFetch.mockResolvedValue({ reports: [], nextCursor: null });
    renderPage();
    expect(await screen.findByText("Жалоб нет")).toBeInTheDocument();
  });
});