import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { PostCard } from "./PostCard";
import type { Post } from "@/entities/post";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock("@/entities/session/model/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/features/block-editor", () => ({ BlockEditor: () => <div /> }));
vi.mock("@/features/report", () => ({
  ReportDialog: ({ targetType, targetId }: { targetType: string; targetId: string }) => (
    <div role="dialog">{`${targetType}:${targetId}`}</div>
  ),
}));

const POST = {
  id: "p1",
  title: "Заголовок",
  content: "Текст",
  tags: [],
  createdAt: "2026-10-01T10:00:00.000Z",
  viewsCount: 1,
  likesCount: 0,
  commentsCount: 0,
  isLikedByMe: false,
  isBookmarkedByMe: false,
  author: { id: "u2", username: "bob", displayName: null, avatarColor: null },
} as unknown as Post;

const renderCard = () =>
  render(
    <MemoryRouter>
      <PostCard post={POST} />
    </MemoryRouter>,
  );

beforeEach(() => mockUseAuth.mockReset());

describe("PostCard: жалоба", () => {
  it("на чужой пост кнопка есть и открывает диалог", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Пожаловаться на пост" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("post:p1");
  });

  it("на свой пост кнопки нет", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u2" } });
    renderCard();
    expect(screen.queryByRole("button", { name: "Пожаловаться на пост" })).not.toBeInTheDocument();
  });

  it("анониму кнопки нет", () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderCard();
    expect(screen.queryByRole("button", { name: "Пожаловаться на пост" })).not.toBeInTheDocument();
  });
});