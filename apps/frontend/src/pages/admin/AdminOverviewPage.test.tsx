import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminOverviewPage } from "./AdminOverviewPage";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock("../../lib/adminApi", () => ({ fetchAdminStats: mockFetch }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AdminOverviewPage />
    </QueryClientProvider>,
  );
}

const STATS = {
  users: { total: 1234, last24h: 5, last7d: 42 },
  posts: 300,
  comments: 900,
  conversations: 17,
  messages: 2500,
  generatedAt: "2026-10-30T10:00:00.000Z",
};

describe("AdminOverviewPage", () => {
  it("показывает загрузку, затем счётчики", async () => {
    mockFetch.mockResolvedValue(STATS);
    renderPage();
    expect(screen.getByText("Загрузка…")).toBeInTheDocument();

    expect(await screen.findByText("Всего")).toBeInTheDocument();
    expect(screen.getByText("За 24 часа")).toBeInTheDocument();
    expect(screen.getByText("За 7 дней")).toBeInTheDocument();
    expect(screen.getByText("Постов")).toBeInTheDocument();
    expect(screen.getByText("Комментариев")).toBeInTheDocument();
    expect(screen.getByText("Диалогов")).toBeInTheDocument();
    expect(screen.getByText("Сообщений")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("форматирует большие числа по-русски", async () => {
    mockFetch.mockResolvedValue(STATS);
    renderPage();
    await screen.findByText("Всего");
    // пробел-разделитель может быть неразрывным, поэтому нормализуем
    const text = document.body.textContent!.replace(/\s/g, " ");
    expect(text).toContain("1 234");
  });

  it("при ошибке показывает сообщение и кнопку «Повторить»", async () => {
    mockFetch.mockRejectedValue(new Error("x"));
    renderPage();
    expect(await screen.findByText("Не удалось загрузить статистику")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });
});