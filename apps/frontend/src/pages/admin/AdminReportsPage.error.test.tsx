import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminReportsPage } from "./AdminReportsPage";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock("../../lib/api", () => ({ api: { get: mockGet } }));

describe("AdminReportsPage: ошибка загрузки", () => {
  it("показывает сообщение и кнопку «Повторить»", async () => {
    mockGet.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminReportsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Не удалось загрузить жалобы")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });
});