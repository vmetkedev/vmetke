import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: null as null | { id: string; username: string; avatarColor: number | null },
  logout: vi.fn(),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, logout: auth.logout }),
}));

vi.mock("./Avatar", () => ({
  Avatar: () => null,
}));

vi.mock("../lib/messages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/messages")>()),
  fetchConversations: vi.fn(),
}));

import { MESSAGES_CHANGED_EVENT, fetchConversations, type Conversation } from "../lib/messages";
import { ProfileMenu } from "./ProfileMenu";

const conv = (id: number, unreadCount: number): Conversation => ({
  id,
  otherUser: { id: `u${id}`, username: `user${id}`, displayName: null, avatarColor: null },
  lastMessage: { id: 1, content: "hi", senderId: `u${id}`, createdAt: new Date().toISOString() },
  unreadCount,
});

function setup() {
  return render(
    <MemoryRouter>
      <ProfileMenu />
    </MemoryRouter>,
  );
}

const menuButton = () => screen.getByRole("button", { name: "Меню профиля" });

beforeEach(() => {
  vi.resetAllMocks();
  auth.user = { id: "me-id", username: "me", avatarColor: null };
  vi.mocked(fetchConversations).mockResolvedValue({ conversations: [] });
});

describe("ProfileMenu: сообщения", () => {
  it("ничего не рендерит и не опрашивает сообщения без пользователя", () => {
    auth.user = null;
    const { container } = setup();

    expect(container).toBeEmptyDOMElement();
    expect(fetchConversations).not.toHaveBeenCalled();
  });

  it("пункт «Сообщения» ведёт на /messages и стоит над «Закладками»", async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(fetchConversations).toHaveBeenCalled());

    await user.click(menuButton());

    const messages = screen.getByRole("link", { name: /Сообщения/ });
    expect(messages).toHaveAttribute("href", "/messages");
    expectBefore(messages, screen.getByRole("link", { name: /Закладки/ }));
  });

  it("без непрочитанных нет ни точки на аватарке, ни бейджа в меню", async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(fetchConversations).toHaveBeenCalled());

    expect(menuButton().querySelector("span")).toBeNull();
    await user.click(menuButton());
    expect(screen.getByRole("link", { name: "Сообщения" })).toBeInTheDocument();
  });

  it("суммирует непрочитанные по диалогам: точка на аватарке и бейдж в меню", async () => {
    vi.mocked(fetchConversations).mockResolvedValue({
      conversations: [conv(1, 2), conv(2, 3)],
    });
    const user = userEvent.setup();
    setup();

    await waitFor(() => expect(menuButton().querySelector("span")).not.toBeNull());
    await user.click(menuButton());

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("ограничивает бейдж значением 99+", async () => {
    vi.mocked(fetchConversations).mockResolvedValue({ conversations: [conv(1, 150)] });
    const user = userEvent.setup();
    setup();

    await waitFor(() => expect(menuButton().querySelector("span")).not.toBeNull());
    await user.click(menuButton());

    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("перезагружает счётчик по событию messages:changed", async () => {
    setup();
    await waitFor(() => expect(fetchConversations).toHaveBeenCalledTimes(1));
    expect(menuButton().querySelector("span")).toBeNull();

    vi.mocked(fetchConversations).mockResolvedValue({ conversations: [conv(1, 4)] });
    act(() => {
      window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
    });

    await waitFor(() => expect(menuButton().querySelector("span")).not.toBeNull());
  });

  it("после размонтирования перестаёт слушать событие", async () => {
    const { unmount } = setup();
    await waitFor(() => expect(fetchConversations).toHaveBeenCalledTimes(1));
    unmount();

    window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));

    expect(fetchConversations).toHaveBeenCalledTimes(1);
  });
});

function expectBefore(a: HTMLElement, b: HTMLElement) {
  expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}