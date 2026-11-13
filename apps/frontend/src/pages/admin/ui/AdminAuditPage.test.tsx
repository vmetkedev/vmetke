import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminAuditPage } from "./AdminAuditPage";

const api = vi.hoisted(() => ({ fetchAdminAudit: vi.fn(), fetchAdminAuditEntry: vi.fn() }));
vi.mock("@/pages/admin/api/admin", () => api);

const entry = (id: number, extra = {}) => ({
  id,
  action: "user.ban",
  targetType: "user",
  targetId: "8c1f0d52-2a77-4a3e-9d16-1b0a2f6a9e11",
  createdAt: "2026-10-01T10:00:00.000Z",
  admin: { id: "a1", username: "root" },
  reason: "спам",
  targetLabel: "bob",
  ...extra,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AdminAuditPage />
    </QueryClientProvider>,
  );
}

// Тексты действий и типов целей есть и в выпадающих списках фильтров,
// поэтому дожидаемся именно списка записей и ищем внутри него.
const loadedList = () => screen.findByRole("list");

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.fetchAdminAudit.mockResolvedValue({ entries: [entry(2)], nextCursor: null });
});

describe("AdminAuditPage: список", () => {
  it("показывает действие, цель, админа и причину", async () => {
    renderPage();
    const list = within(await loadedList());
    expect(list.getByText("Блокировка")).toBeInTheDocument();
    expect(list.getByText("Пользователь · @bob")).toBeInTheDocument();
    expect(list.getByText("@root")).toBeInTheDocument();
    expect(list.getByText("спам")).toBeInTheDocument();
  });

  it("записи из CLI подписаны, неизвестное действие показывается как есть, цель без подписи показывает короткий id", async () => {
    api.fetchAdminAudit.mockResolvedValue({
      entries: [
        entry(3, { action: "future.thing", admin: null, reason: null, targetLabel: null, targetType: "widget" }),
      ],
      nextCursor: null,
    });
    renderPage();
    const list = within(await loadedList());
    expect(list.getByText("future.thing")).toBeInTheDocument();
    expect(list.getByText("CLI / система")).toBeInTheDocument();
    expect(list.getByText("widget · 8c1f0d52…")).toBeInTheDocument();
  });

  it("пустой журнал", async () => {
    api.fetchAdminAudit.mockResolvedValue({ entries: [], nextCursor: null });
    renderPage();
    expect(await screen.findByText("Записей нет")).toBeInTheDocument();
  });

  it("«Показать ещё» подгружает следующую страницу по числовому курсору", async () => {
    api.fetchAdminAudit
      .mockResolvedValueOnce({ entries: [entry(2)], nextCursor: 2 })
      .mockResolvedValueOnce({
        entries: [entry(1, { action: "post.delete", targetLabel: "alice" })],
        nextCursor: null,
      });
    renderPage();
    const list = within(await loadedList());
    expect(list.getByText("Блокировка")).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Показать ещё" }));
    expect(await list.findByText("Удаление поста")).toBeInTheDocument();
    expect(api.fetchAdminAudit).toHaveBeenLastCalledWith(expect.anything(), 2);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Показать ещё" })).not.toBeInTheDocument(),
    );
  });
});

describe("AdminAuditPage: фильтры", () => {
  it("действие, тип цели и даты уходят на бэкенд сразу", async () => {
    renderPage();
    await loadedList();

    await userEvent.selectOptions(screen.getByLabelText("Действие"), "post.delete");
    await waitFor(() =>
      expect(api.fetchAdminAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "post.delete" }),
        undefined,
      ),
    );

    await userEvent.selectOptions(screen.getByLabelText("Тип цели"), "comment");
    await waitFor(() =>
      expect(api.fetchAdminAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "post.delete", targetType: "comment" }),
        undefined,
      ),
    );

    await userEvent.type(screen.getByLabelText("С даты"), "2026-01-15");
    await waitFor(() =>
      expect(api.fetchAdminAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: "2026-01-15" }),
        undefined,
      ),
    );
  });

  it("админ (с @ и без) и id цели уходят на бэкенд с задержкой", async () => {
    renderPage();
    await loadedList();

    await userEvent.type(screen.getByLabelText("Админ (username)"), "@root");
    await waitFor(() =>
      expect(api.fetchAdminAudit).toHaveBeenLastCalledWith(expect.objectContaining({ admin: "root" }), undefined),
    );

    await userEvent.type(screen.getByLabelText("ID цели"), "abc-123");
    await waitFor(() =>
      expect(api.fetchAdminAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ admin: "root", targetId: "abc-123" }),
        undefined,
      ),
    );
  });
});

describe("AdminAuditPage: карточка записи", () => {
  it("«Подробнее» подгружает и показывает details, «Скрыть» сворачивает", async () => {
    api.fetchAdminAuditEntry.mockResolvedValue({
      ...entry(2),
      details: { reason: "спам", snapshot: { content: "полный текст снимка" } },
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Подробнее" }));

    expect(api.fetchAdminAuditEntry).toHaveBeenCalledWith(2);
    expect(await screen.findByText(/полный текст снимка/)).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "Скрыть" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    expect(screen.queryByText(/полный текст снимка/)).not.toBeInTheDocument();
  });

  it("details выводится текстом: разметка в снимке не выполняется", async () => {
    api.fetchAdminAuditEntry.mockResolvedValue({
      ...entry(2),
      details: { snapshot: { content: "<img src=x onerror=alert(1)>" } },
    });
    renderPage();
    const list = await loadedList();
    const row = list.querySelector("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Подробнее" }));
    await within(row).findByText(/onerror/);
    expect(row.querySelector("img")).toBeNull();
  });

  it("ошибка загрузки записи показывается в строке", async () => {
    api.fetchAdminAuditEntry.mockRejectedValue(new Error("x"));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Подробнее" }));
    expect(await screen.findByText("Не удалось загрузить запись")).toBeInTheDocument();
  });
});