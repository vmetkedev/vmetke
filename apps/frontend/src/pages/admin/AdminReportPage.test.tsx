import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminReportPage } from "./AdminReportPage";

const api = vi.hoisted(() => ({ fetchAdminReport: vi.fn(), resolveAdminReport: vi.fn() }));
vi.mock("../../lib/adminApi", () => api);

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

const me = (role: "moderator" | "admin", id = "me") => ({ user: { id, username: "root", avatarColor: null, role } });

const REPORT = {
  id: "r1",
  targetType: "post" as const,
  targetId: "p1",
  reason: "abuse" as const,
  comment: "грубит в тексте",
  status: "open" as const,
  createdAt: "2026-10-01T10:00:00.000Z",
  reporter: { id: "u9", username: "rita" },
  targetUser: { id: "u2", username: "bob", role: "user" as const, bannedAt: null, deletedAt: null },
  snapshot: { id: "p1", title: "Заголовок поста", content: "Текст нарушения", tags: ["а"], authorUsername: "bob" },
  resolvedAt: null,
  resolutionAction: null,
  resolutionReason: null,
  resolvedBy: null,
  openReportsForTarget: 1,
  contentExists: true,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin/reports/r1"]}>
        <Routes>
          <Route path="/admin/reports/:id" element={<AdminReportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.fetchAdminReport.mockResolvedValue(REPORT);
  api.resolveAdminReport.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue(me("admin"));
});

describe("AdminReportPage: содержимое", () => {
  it("показывает снимок поста, причину, комментарий и жалобщика", async () => {
    renderPage();
    expect(await screen.findByText("Текст нарушения")).toBeInTheDocument();
    expect(screen.getByText("Заголовок поста")).toBeInTheDocument();
    expect(screen.getByText("Оскорбления или травля")).toBeInTheDocument();
    expect(screen.getByText("грубит в тексте")).toBeInTheDocument();
    expect(screen.getByText("@rita")).toBeInTheDocument();
  });

  it("число открытых жалоб на объект показывается, только если их больше одной", async () => {
    api.fetchAdminReport.mockResolvedValue({ ...REPORT, openReportsForTarget: 3 });
    renderPage();
    expect(await screen.findByText("Открытых жалоб на объект")).toBeInTheDocument();
  });

  it("жалоба на сообщение: сообщение, контекст и пометка о приватности", async () => {
    api.fetchAdminReport.mockResolvedValue({
      ...REPORT,
      targetType: "message",
      targetId: "42",
      contentExists: false,
      snapshot: {
        message: { id: 42, senderUsername: "bob", content: "оскорбление", createdAt: "2026-10-01T10:00:00.000Z" },
        context: [{ id: 41, senderUsername: "rita", content: "предыдущее сообщение", createdAt: "2026-10-01T09:59:00.000Z" }],
      },
    });
    renderPage();
    expect(await screen.findByText("оскорбление")).toBeInTheDocument();
    expect(screen.getByText("предыдущее сообщение")).toBeInTheDocument();
    expect(screen.getByText(/Остальная переписка/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Удалить контент" })).not.toBeInTheDocument();
  });

  it("жалоба на пользователя: удалять нечего", async () => {
    api.fetchAdminReport.mockResolvedValue({
      ...REPORT,
      targetType: "user",
      targetId: "u2",
      contentExists: false,
      snapshot: { id: "u2", username: "bob", displayName: "Боб", bio: "Описание профиля" },
    });
    renderPage();
    expect(await screen.findByText("Описание профиля")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Удалить контент" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Заблокировать автора" })).toBeEnabled();
  });
});

describe("AdminReportPage: действия", () => {
  it("удаление контента: причина обязательна, затем вызывает resolve", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Удалить контент" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Удалить" });
    expect(confirm).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText(/Причина/), "  спам  ");
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);

    await waitFor(() => expect(api.resolveAdminReport).toHaveBeenCalledWith("r1", "delete_content", "спам"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("блокировка автора (админ): причина обязательна", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Заблокировать автора" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Заблокировать" })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Причина/), "систематический спам");
    await userEvent.click(within(dialog).getByRole("button", { name: "Заблокировать" }));
    await waitFor(() =>
      expect(api.resolveAdminReport).toHaveBeenCalledWith("r1", "ban_author", "систематический спам"),
    );
  });

  it("отклонение: причина необязательна", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Отклонить" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Отклонить" });
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(api.resolveAdminReport).toHaveBeenCalledWith("r1", "dismiss", ""));
  });

  it("ошибка сервера показывается в диалоге, диалог остаётся", async () => {
    api.resolveAdminReport.mockRejectedValue(new Error("Жалоба уже обработана"));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Отклонить" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Отклонить" }));
    expect(await within(dialog).findByText("Жалоба уже обработана")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("автор уже заблокирован: диалог предупреждает, что повторной блокировки не будет", async () => {
    api.fetchAdminReport.mockResolvedValue({
      ...REPORT,
      targetUser: { ...REPORT.targetUser, bannedAt: "2026-09-01T10:00:00.000Z" },
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Заблокировать автора" }));
    expect(screen.getByText(/без повторной блокировки/)).toBeInTheDocument();
  });
});

describe("AdminReportPage: права", () => {
  it("модератору блокировка недоступна, подсказка есть, удаление и отклонение доступны", async () => {
    mockUseAuth.mockReturnValue(me("moderator"));
    renderPage();
    const ban = await screen.findByRole("button", { name: "Заблокировать автора" });
    expect(ban).toBeDisabled();
    expect(ban).toHaveAttribute("title", expect.stringContaining("только администратор"));
    expect(screen.getByRole("button", { name: "Удалить контент" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Отклонить" })).toBeEnabled();
  });

  it("модератору недоступно удаление контента модератора", async () => {
    mockUseAuth.mockReturnValue(me("moderator"));
    api.fetchAdminReport.mockResolvedValue({
      ...REPORT,
      targetUser: { ...REPORT.targetUser, role: "moderator" as const },
    });
    renderPage();
    const del = await screen.findByRole("button", { name: "Удалить контент" });
    expect(del).toBeDisabled();
    expect(del).toHaveAttribute("title", expect.stringContaining("только администратор"));
  });

  it("контент уже удалён: удаление неактивно", async () => {
    api.fetchAdminReport.mockResolvedValue({ ...REPORT, contentExists: false });
    renderPage();
    const del = await screen.findByRole("button", { name: "Удалить контент" });
    expect(del).toBeDisabled();
    expect(del).toHaveAttribute("title", "Контент уже удалён");
  });

  it("жалоба на свой контент: блокировка себя неактивна", async () => {
    mockUseAuth.mockReturnValue(me("admin", "u2"));
    renderPage();
    expect(await screen.findByRole("button", { name: "Заблокировать автора" })).toBeDisabled();
  });

  it("автор удалил аккаунт: блокировка неактивна", async () => {
    api.fetchAdminReport.mockResolvedValue({
      ...REPORT,
      contentExists: false,
      targetUser: { ...REPORT.targetUser, deletedAt: "2026-09-01T10:00:00.000Z" },
    });
    renderPage();
    expect(await screen.findByRole("button", { name: "Заблокировать автора" })).toBeDisabled();
  });
});

describe("AdminReportPage: обработанная жалоба", () => {
  it("показывает итог и не показывает кнопки действий", async () => {
    api.fetchAdminReport.mockResolvedValue({
      ...REPORT,
      status: "resolved",
      resolutionAction: "content_deleted",
      resolutionReason: "нарушение правил",
      resolvedAt: "2026-10-02T10:00:00.000Z",
      resolvedBy: { id: "m1", username: "mod1" },
      contentExists: false,
    });
    renderPage();
    expect(await screen.findByText("Контент удалён")).toBeInTheDocument();
    expect(screen.getByText("нарушение правил")).toBeInTheDocument();
    expect(screen.getByText(/@mod1/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отклонить" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Заблокировать автора" })).not.toBeInTheDocument();
  });
});