import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import { PostCard } from "./PostCard";
import * as postsLib from "../lib/posts";
import * as authContext from "../auth/AuthContext";
import type { Post } from "../lib/posts";

vi.mock("../lib/posts", async () => {
  const actual = await vi.importActual<typeof import("../lib/posts")>("../lib/posts");
  return {
    ...actual,
    updatePost: vi.fn(),
    deletePost: vi.fn(),
    likePost: vi.fn(),
    unlikePost: vi.fn(),
    bookmarkPost: vi.fn(),
    unbookmarkPost: vi.fn(),
  };
});
vi.mock("../auth/AuthContext");

const mockUser = { id: "user-1", username: "admin", avatarColor: "#123456" };

const mockPost = {
  id: "post-1",
  title: "Заголовок поста",
  content: "Исходный текст",
  author: {
    id: "user-1",
    username: "admin",
    displayName: "Admin",
    avatarColor: "#123456",
  },
  createdAt: new Date().toISOString(),
  viewsCount: 10,
  likesCount: 0,
  commentsCount: 0,
  isLikedByMe: false,
  isBookmarkedByMe: false,
} as unknown as Post;

function renderPostCard() {
  return render(
    <MemoryRouter>
      <PostCard post={mockPost} linkTitle={false} />
    </MemoryRouter>
  );
}

describe("PostCard редактирование", () => {
  beforeEach(() => {
    vi.mocked(authContext.useAuth).mockReturnValue({ user: mockUser } as any);
    vi.mocked(postsLib.updatePost).mockResolvedValue(mockPost);
  });

  it("показывает кнопку редактирования для своего поста в режиме списка (linkTitle=false)", () => {
    const { container } = renderPostCard();
    expect(container.querySelector("svg.lucide-pencil")).toBeInTheDocument();
  });

  it("не показывает шестерёнку настроек до входа в режим редактирования", () => {
    renderPostCard();
    expect(screen.queryByTitle("Настройки редактора")).not.toBeInTheDocument();
  });

  it("вход в редактирование показывает заголовок в поле ввода и шестерёнку настроек, редактор по умолчанию WYSIWYG", async () => {
    const { container } = renderPostCard();
    const editButton = container.querySelector("svg.lucide-pencil")!.closest("button")!;
    fireEvent.click(editButton);

    expect(screen.getByDisplayValue("Заголовок поста")).toBeInTheDocument();
    expect(screen.getByTitle("Настройки редактора")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Исходный текст")).not.toBeInTheDocument();
  });

  it("переключение на Markdown через модалку настроек показывает textarea с содержимым поста", async () => {
    const { container } = renderPostCard();
    const editButton = container.querySelector("svg.lucide-pencil")!.closest("button")!;
    fireEvent.click(editButton);

    fireEvent.click(screen.getByTitle("Настройки редактора"));
    fireEvent.click(screen.getByLabelText(/Markdown/));
    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Исходный текст")).toBeInTheDocument();
    });
  });

  it("отмена редактирования сбрасывает заголовок/текст и возвращает WYSIWYG-режим", async () => {
    const { container } = renderPostCard();
    const editButton = container.querySelector("svg.lucide-pencil")!.closest("button")!;
    fireEvent.click(editButton);

    fireEvent.change(screen.getByDisplayValue("Заголовок поста"), {
      target: { value: "Изменённый заголовок" },
    });

    fireEvent.click(screen.getByTitle("Настройки редактора"));
    fireEvent.click(screen.getByLabelText(/Markdown/));
    fireEvent.click(screen.getByText("Сохранить"));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Исходный текст")).toBeInTheDocument();
    });

    const cancelButton = container.querySelector("svg.lucide-x")!.closest("button")!;
    fireEvent.click(cancelButton);

    expect(screen.queryByDisplayValue("Изменённый заголовок")).not.toBeInTheDocument();
    expect(screen.getByText("Заголовок поста")).toBeInTheDocument();
  });

  it("сохранение через Markdown-режим вызывает updatePost с обновлённым заголовком и текстом", async () => {
    const { container } = renderPostCard();
    const editButton = container.querySelector("svg.lucide-pencil")!.closest("button")!;
    fireEvent.click(editButton);

    fireEvent.click(screen.getByTitle("Настройки редактора"));
    fireEvent.click(screen.getByLabelText(/Markdown/));
    fireEvent.click(screen.getByText("Сохранить"));

    const textarea = await screen.findByDisplayValue("Исходный текст");
    fireEvent.change(screen.getByDisplayValue("Заголовок поста"), {
      target: { value: "Новый заголовок" },
    });
    fireEvent.change(textarea, { target: { value: "Новый текст" } });

    const saveButton = container.querySelector("svg.lucide-check")!.closest("button")!;
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(postsLib.updatePost).toHaveBeenCalledWith("post-1", "Новый заголовок", "Новый текст");
    });
  });
});