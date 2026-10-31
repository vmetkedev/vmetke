import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminContentPage } from "./AdminContentPage";

const api = vi.hoisted(() => ({
  fetchAdminPosts: vi.fn(),
  fetchAdminPost: vi.fn(),
  deleteAdminPost: vi.fn(),
  fetchAdminComments: vi.fn(),
  deleteAdminComment: vi.fn(),
}));
vi.mock("../../lib/adminApi", () => api);
const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

const me = (role: "moderator" | "admin", id = "me") => ({
  user: { id, username: "root", avatarColor: null, role },
});

const AUTHOR = { id: "u1", username: "alice", avatarColor: null, role: "user" as const };
const POST = {
  id: "p1",
  title: "Первый пост",
  excerpt: "Начало текста поста",
  tags: [],
  views: 11,
  createdAt: "2026-10-01T10:00:00.000Z",
  likesCount: 4,
  commentsCount: 2,
  author: AUTHOR,
};
const COMMENT = {
  id: "c1",
  content: "Грубый комментарий",
  createdAt: "2026-10-02T10:00:00.000Z",
  author: AUTHOR,
  post: { id: "p1", title: "Первый пост" },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminContentPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.fetchAdminPosts.mockResolvedValue({ posts: [POST], nextCursor: null });
  api.fetchAdminComments.mockResolvedValue({ comments: [COMMENT], nextCursor: null });
  mockUseAuth.mockReturnValue(me("admin"));
});

describe("AdminContentPage: посты", () => {
  it("показывает пост со счётчиками и автором", async () => {
    renderPage();
    expect(await screen.findByText("Первый пост")).toBeInTheDocument();
    expect(screen.getByText("Начало текста поста")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "@alice" })).toHaveAttribute("href", "/u/alice");
    expect(screen.getByText("Лайков: 4")).toBeInTheDocument();
    expect(screen.getByText("Комментариев: 2")).toBeInTheDocument();
  });

  it("пустой результат", async () => {
    api.fetchAdminPosts.mockResolvedValue({ posts: [], nextCursor: null });
    renderPage();
    expect(await screen.findByText("Ничего не найдено")).toBeInTheDocument();
  });

  it("фильтры уходят на бэкенд (текст и автор с задержкой, даты сразу)", async () => {
    renderPage();
    await screen.findByText("Первый пост");

    await userEvent.type(screen.getByLabelText("Поиск"), "спам");
    await waitFor(() =>
      expect(api.fetchAdminPosts).toHaveBeenLastCalledWith(expect.objectContaining({ q: "спам" }), undefined),
    );

    await userEvent.type(screen.getByLabelText("Автор (username)"), "@alice");
    await waitFor(() =>
      expect(api.fetchAdminPosts).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "спам", author: "alice" }),
        undefined,
      ),
    );

    fireEvent.change(screen.getByLabelText("С даты"), { target: { value: "2026-01-15" } });
    fireEvent.change(screen.getByLabelText("По дату"), { target: { value: "2026-01-20" } });
    await waitFor(() =>
      expect(api.fetchAdminPosts).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: "2026-01-15", to: "2026-01-20" }),
        undefined,
      ),
    );
  });

  it("«Показать ещё» подгружает следующую страницу по курсору", async () => {
    api.fetchAdminPosts
      .mockResolvedValueOnce({ posts: [POST], nextCursor: "p1" })
      .mockResolvedValueOnce({ posts: [{ ...POST, id: "p2", title: "Второй пост" }], nextCursor: null });
    renderPage();
    await screen.findByText("Первый пост");
    await userEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    expect(await screen.findByText("Второй пост")).toBeInTheDocument();
    expect(api.fetchAdminPosts).toHaveBeenLastCalledWith(expect.anything(), "p1");
  });

  it("просмотр показывает полный текст", async () => {
    api.fetchAdminPost.mockResolvedValue({ ...POST, content: "Полный текст поста целиком" });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Открыть" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Полный текст поста целиком")).toBeInTheDocument();
    expect(api.fetchAdminPost).toHaveBeenCalledWith("p1");
  });

  it("удаление: кнопка неактивна без причины, затем удаляет и перезагружает список", async () => {
    api.deleteAdminPost.mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Удалить" }));

    const dialog = screen.getByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Удалить" });
    expect(submit).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText("Причина"), "  спам  ");
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    await waitFor(() => expect(api.deleteAdminPost).toHaveBeenCalledWith("p1", "спам"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(api.fetchAdminPosts.mock.calls.length).toBeGreaterThan(1));
  });

  it("ошибка сервера показывается в диалоге, диалог остаётся", async () => {
    api.deleteAdminPost.mockRejectedValue(new Error("Пост не найден"));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Удалить" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Причина"), "спам");
    await userEvent.click(within(dialog).getByRole("button", { name: "Удалить" }));
    expect(await within(dialog).findByText("Пост не найден")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("AdminContentPage: комментарии", () => {
  it("вкладка показывает комментарии с постом и автором", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Комментарии" }));
    expect(await screen.findByText("Грубый комментарий")).toBeInTheDocument();
    expect(screen.getByText("К посту: Первый пост")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "@alice" })).toBeInTheDocument();
  });

  it("удаление комментария отправляет причину", async () => {
    api.deleteAdminComment.mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Комментарии" }));
    await userEvent.click(await screen.findByRole("button", { name: "Удалить" }));

    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Причина"), "оскорбление");
    await userEvent.click(within(dialog).getByRole("button", { name: "Удалить" }));

    await waitFor(() => expect(api.deleteAdminComment).toHaveBeenCalledWith("c1", "оскорбление"));
  });
});

describe("AdminContentPage: права модератора", () => {
  const MOD_AUTHOR = { id: "m2", username: "mod2", avatarColor: null, role: "moderator" as const };

  it("модератору недоступно удаление поста модератора, есть подсказка", async () => {
    mockUseAuth.mockReturnValue(me("moderator"));
    api.fetchAdminPosts.mockResolvedValue({ posts: [{ ...POST, author: MOD_AUTHOR }], nextCursor: null });
    renderPage();
    const btn = await screen.findByRole("button", { name: "Удалить" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", expect.stringContaining("только администратор"));
  });

  it("модератору недоступно удаление комментария модератора", async () => {
    mockUseAuth.mockReturnValue(me("moderator"));
    api.fetchAdminComments.mockResolvedValue({
      comments: [{ ...COMMENT, author: MOD_AUTHOR }],
      nextCursor: null,
    });
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Комментарии" }));
    expect(await screen.findByRole("button", { name: "Удалить" })).toBeDisabled();
  });

  it("модератору доступно удаление поста обычного пользователя", async () => {
    mockUseAuth.mockReturnValue(me("moderator"));
    renderPage();
    expect(await screen.findByRole("button", { name: "Удалить" })).toBeEnabled();
  });

  it("модератору доступно удаление своего поста", async () => {
    mockUseAuth.mockReturnValue(me("moderator", "m2"));
    api.fetchAdminPosts.mockResolvedValue({ posts: [{ ...POST, author: MOD_AUTHOR }], nextCursor: null });
    renderPage();
    expect(await screen.findByRole("button", { name: "Удалить" })).toBeEnabled();
  });

  it("админу доступно удаление поста модератора", async () => {
    api.fetchAdminPosts.mockResolvedValue({ posts: [{ ...POST, author: MOD_AUTHOR }], nextCursor: null });
    renderPage();
    expect(await screen.findByRole("button", { name: "Удалить" })).toBeEnabled();
  });
});