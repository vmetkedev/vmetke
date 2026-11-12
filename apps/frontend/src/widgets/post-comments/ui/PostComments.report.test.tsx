import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { PostComments } from "./PostComments";

const { mockUseAuth, mockFetch } = vi.hoisted(() => ({ mockUseAuth: vi.fn(), mockFetch: vi.fn() }));
vi.mock("@/entities/session/model/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/entities/comment", () => ({
  fetchComments: mockFetch,
  createComment: vi.fn(),
  deleteComment: vi.fn(),
  likeComment: vi.fn(),
  unlikeComment: vi.fn(),
}));
vi.mock("@/features/report", () => ({
  ReportDialog: ({ targetType, targetId }: { targetType: string; targetId: string }) => (
    <div role="dialog">{`${targetType}:${targetId}`}</div>
  ),
}));

const comment = (id: string, authorId: string, username: string) => ({
  id,
  content: `текст ${id}`,
  likesCount: 0,
  isLikedByMe: false,
  createdAt: "2026-10-01T10:00:00.000Z",
  author: { id: authorId, username, displayName: null, avatarColor: null },
});

const renderComments = () =>
  render(
    <MemoryRouter>
      <PostComments postId="p1" />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockUseAuth.mockReset();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue([comment("c1", "u2", "bob"), comment("c2", "u1", "me")]);
});

describe("PostComments: жалоба", () => {
  it("кнопка только у чужих комментариев и открывает диалог", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    renderComments();
    await screen.findByText("текст c1");
    const buttons = screen.getAllByRole("button", { name: "Пожаловаться на комментарий" });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("comment:c1");
  });

  it("анониму кнопок нет", async () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderComments();
    await screen.findByText("текст c1");
    expect(screen.queryByRole("button", { name: "Пожаловаться на комментарий" })).not.toBeInTheDocument();
  });
});