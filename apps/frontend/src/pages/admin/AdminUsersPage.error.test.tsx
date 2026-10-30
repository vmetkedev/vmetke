import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminUsersPage } from "./AdminUsersPage";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock("../../lib/api", () => ({ api: { get: mockGet } }));

describe("AdminUsersPage: ошибка загрузки", () => {
  it("показывает сообщение и кнопку «Повторить»", async () => {
    mockGet.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Не удалось загрузить пользователей")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });
});