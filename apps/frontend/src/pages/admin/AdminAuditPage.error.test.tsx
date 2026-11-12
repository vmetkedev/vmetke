import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminAuditPage } from "./AdminAuditPage";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock("@/shared/api/client", () => ({ api: { get: mockGet } }));

describe("AdminAuditPage: ошибка загрузки", () => {
  it("показывает сообщение и кнопку «Повторить»", async () => {
    mockGet.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AdminAuditPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Не удалось загрузить журнал")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });
});