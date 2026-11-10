import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import NotificationsPage from "./NotificationsPage";

const api = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  deleteNotification: vi.fn(),
}));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", username: "me", avatarColor: null, role: "user" } }),
}));

vi.mock("../lib/realtime", () => ({
  subscribeRealtime: () => () => {},
  subscribeStatus: () => () => {},
  isRealtimeConnected: () => false,
}));
vi.mock("../lib/notifications", () => api);
vi.mock("../components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const base = { read: false, createdAt: "2026-10-01T10:00:00.000Z", postId: null };

function renderPage(notifications: unknown[], unreadCount = notifications.length) {
  api.fetchNotifications.mockResolvedValue({ notifications, unreadCount });
  render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.markNotificationsRead.mockResolvedValue(undefined);
});

describe("NotificationsPage: модерация", () => {
  it("удалённый пост: заголовок и причина, без ссылки на модератора", async () => {
    renderPage([
      {
        ...base,
        id: "n1",
        type: "moderation",
        actor: null,
        details: { action: "post_deleted", title: "Мой пост", reason: "спам" },
      },
    ]);
    expect(await screen.findByText("Ваш пост «Мой пост» удалён модератором.")).toBeInTheDocument();
    expect(screen.getByText("Причина: спам")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("пост без заголовка", async () => {
    renderPage([
      { ...base, id: "n1", type: "moderation", actor: null, details: { action: "post_deleted", title: null, reason: "нарушение" } },
    ]);
    expect(await screen.findByText("Ваш пост «без названия» удалён модератором.")).toBeInTheDocument();
  });

  it("удалённый комментарий: начало текста и причина", async () => {
    renderPage([
      {
        ...base,
        id: "n1",
        type: "moderation",
        actor: null,
        details: { action: "comment_deleted", title: "грубый текст", reason: "оскорбление" },
      },
    ]);
    expect(await screen.findByText("Ваш комментарий «грубый текст» удалён модератором.")).toBeInTheDocument();
    expect(screen.getByText("Причина: оскорбление")).toBeInTheDocument();
  });

  it("обычное уведомление по-прежнему ведёт на профиль актёра", async () => {
    renderPage([
      {
        ...base,
        id: "n2",
        type: "follow",
        actor: { id: "u2", username: "bob", displayName: null, avatarUrl: null },
      },
    ]);
    const link = await screen.findByRole("link", { name: /bob/ });
    expect(link).toHaveAttribute("href", "/u/bob");
  });

  it("при непрочитанных отмечает всё прочитанным", async () => {
    renderPage([
      { ...base, id: "n1", type: "moderation", actor: null, details: { action: "post_deleted", title: "x", reason: "y" } },
    ]);
    await screen.findByText(/удалён модератором/);
    expect(api.markNotificationsRead).toHaveBeenCalled();
  });
});