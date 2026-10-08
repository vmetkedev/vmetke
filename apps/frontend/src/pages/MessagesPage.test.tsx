import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ME } = vi.hoisted(() => ({ ME: "me-id" }));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: ME, username: "me", avatarColor: null } }),
}));

vi.mock("../components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("../components/Avatar", () => ({
  Avatar: () => null,
}));

vi.mock("../lib/messages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/messages")>()),
  fetchConversations: vi.fn(),
  fetchMessages: vi.fn(),
  sendMessage: vi.fn(),
  markConversationRead: vi.fn(),
}));

import {
  fetchConversations,
  fetchMessages,
  markConversationRead,
  sendMessage,
  type Conversation,
  type ConversationUser,
  type Message,
} from "../lib/messages";
import MessagesPage from "./MessagesPage";

const BOB: ConversationUser = { id: "bob-id", username: "bob", displayName: "Боб", avatarColor: 1 };
const ALICE: ConversationUser = { id: "alice-id", username: "alice", displayName: null, avatarColor: 2 };

const now = () => new Date().toISOString();

const msg = (id: number, senderId: string, content: string, conversationId = 5): Message => ({
  id,
  conversationId,
  senderId,
  content,
  createdAt: now(),
  deleted: false,
});

const conv = (over: Partial<Conversation> = {}): Conversation => ({
  id: 5,
  otherUser: BOB,
  lastMessage: { id: 2, content: "последнее", senderId: BOB.id, createdAt: now(), deleted: false },
  unreadCount: 0,
  ...over,
});

function renderAt(entry: string | { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:id" element={<MessagesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function expectBefore(a: HTMLElement, b: HTMLElement) {
  expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

const input = () => screen.getByPlaceholderText("Напишите сообщение...");
const sendButton = () => screen.getByRole("button", { name: "Отправить" });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchConversations).mockResolvedValue({ conversations: [] });
  vi.mocked(fetchMessages).mockResolvedValue({ messages: [], nextCursor: null });
  vi.mocked(markConversationRead).mockResolvedValue(undefined);
});

describe("MessagesPage: список диалогов", () => {
  it("показывает загрузку, пока список не получен", () => {
    vi.mocked(fetchConversations).mockReturnValue(new Promise(() => {}));
    renderAt("/messages");

    expect(screen.getByText("Загрузка...")).toBeInTheDocument();
  });

  it("показывает пустое состояние и заглушку переписки", async () => {
    renderAt("/messages");

    expect(await screen.findByText(/Пока нет диалогов/)).toBeInTheDocument();
    expect(screen.getByText("Выберите диалог")).toBeInTheDocument();
  });

  it("рисует диалоги: имя, username, префикс «Вы:» и бейдж непрочитанных", async () => {
    vi.mocked(fetchConversations).mockResolvedValue({
      conversations: [
        conv({ unreadCount: 3, lastMessage: { id: 2, content: "привет, как дела", senderId: BOB.id, createdAt: now(), deleted: false } }),
        conv({
          id: 6,
          otherUser: ALICE,
          lastMessage: { id: 9, content: "ок", senderId: ME, createdAt: now(), deleted: false },
        }),
      ],
    });
    renderAt("/messages");

    expect(await screen.findByText("Боб")).toBeInTheDocument();
    expect(screen.getByText("привет, как дела")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("Вы: ок")).toBeInTheDocument();
  });

  it("ссылка на диалог открывает переписку", async () => {
    vi.mocked(fetchConversations).mockResolvedValue({ conversations: [conv()] });
    const user = userEvent.setup();
    renderAt("/messages");

    await user.click(await screen.findByRole("link", { name: /Боб/ }));

    expect(await screen.findByPlaceholderText("Напишите сообщение...")).toBeInTheDocument();
    expect(fetchMessages).toHaveBeenCalledWith(5);
  });

  it("не показывает бейдж непрочитанных у открытого диалога", async () => {
    vi.mocked(fetchConversations).mockResolvedValue({ conversations: [conv({ unreadCount: 3 })] });
    renderAt("/messages/5");

    await screen.findByText("последнее");
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });
});

describe("MessagesPage: переписка", () => {
  it("выводит сообщения по возрастанию id (API отдаёт новые первыми)", async () => {
    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [msg(2, ME, "второе"), msg(1, BOB.id, "первое")],
      nextCursor: null,
    });
    renderAt("/messages/5");

    const first = await screen.findByText("первое");
    const second = screen.getByText("второе");
    expectBefore(first, second);
  });

  it("показывает пустое состояние пустого диалога", async () => {
    renderAt("/messages/5");

    expect(await screen.findByText("Сообщений пока нет. Напишите первым.")).toBeInTheDocument();
  });

  it("показывает ошибку, если история не загрузилась", async () => {
    vi.mocked(fetchMessages).mockRejectedValue(new Error("Диалог не найден"));
    renderAt("/messages/5");

    expect(await screen.findByText("Диалог не найден")).toBeInTheDocument();
  });

  it("в шапке показывает собеседника из списка диалогов со ссылкой на профиль", async () => {
    vi.mocked(fetchConversations).mockResolvedValue({ conversations: [conv()] });
    renderAt("/messages/5");

    const link = await screen.findByRole("link", { name: "Боб" });
    expect(link).toHaveAttribute("href", "/u/bob");
  });

  it("если диалога нет в списке, берёт собеседника из location.state", async () => {
    renderAt({ pathname: "/messages/5", state: { otherUser: BOB } });

    const link = await screen.findByRole("link", { name: "Боб" });
    expect(link).toHaveAttribute("href", "/u/bob");
  });

  it("помечает диалог прочитанным, если есть входящие", async () => {
    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [msg(1, BOB.id, "привет")],
      nextCursor: null,
    });
    renderAt("/messages/5");

    await screen.findByText("привет");
    await waitFor(() => expect(markConversationRead).toHaveBeenCalledWith(5));
  });

  it("не помечает прочитанным, если в диалоге только свои сообщения", async () => {
    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [msg(1, ME, "мое")],
      nextCursor: null,
    });
    renderAt("/messages/5");

    await screen.findByText("мое");
    expect(markConversationRead).not.toHaveBeenCalled();
  });
});

describe("MessagesPage: отправка", () => {
  it("кнопка отправки неактивна для пустого и пробельного текста", async () => {
    const user = userEvent.setup();
    renderAt("/messages/5");
    await screen.findByText("Сообщений пока нет. Напишите первым.");

    expect(sendButton()).toBeDisabled();
    await user.type(input(), "   ");
    expect(sendButton()).toBeDisabled();
  });

  it("отправляет обрезанный текст, очищает поле и показывает сообщение", async () => {
    vi.mocked(sendMessage).mockResolvedValue(msg(1, ME, "привет"));
    const user = userEvent.setup();
    renderAt("/messages/5");
    await screen.findByText("Сообщений пока нет. Напишите первым.");

    await user.type(input(), "  привет  ");
    await user.click(sendButton());

    expect(await screen.findByText("привет")).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith(5, "привет");
    expect(input()).toHaveValue("");
    await waitFor(() => expect(fetchConversations).toHaveBeenCalledTimes(2));
  });

  it("Enter отправляет сообщение", async () => {
    vi.mocked(sendMessage).mockResolvedValue(msg(1, ME, "привет"));
    const user = userEvent.setup();
    renderAt("/messages/5");
    await screen.findByText("Сообщений пока нет. Напишите первым.");

    await user.type(input(), "привет{Enter}");

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(5, "привет"));
  });

  it("Shift+Enter переносит строку и ничего не отправляет", async () => {
    const user = userEvent.setup();
    renderAt("/messages/5");
    await screen.findByText("Сообщений пока нет. Напишите первым.");

    await user.type(input(), "a{Shift>}{Enter}{/Shift}b");

    expect(sendMessage).not.toHaveBeenCalled();
    expect(input()).toHaveValue("a\nb");
  });

  it("при ошибке показывает её и сохраняет текст", async () => {
    vi.mocked(sendMessage).mockRejectedValue(new Error("Диалог не найден"));
    const user = userEvent.setup();
    renderAt("/messages/5");
    await screen.findByText("Сообщений пока нет. Напишите первым.");

    await user.type(input(), "привет");
    await user.click(sendButton());

    expect(await screen.findByText("Диалог не найден")).toBeInTheDocument();
    expect(input()).toHaveValue("привет");
  });
});

describe("MessagesPage: подгрузка истории", () => {
  it("«Показать более ранние» грузит по курсору и ставит старые сообщения выше", async () => {
    vi.mocked(fetchMessages)
      .mockResolvedValueOnce({
        messages: [msg(3, ME, "третье"), msg(2, ME, "второе")],
        nextCursor: 2,
      })
      .mockResolvedValueOnce({ messages: [msg(1, ME, "первое")], nextCursor: null });
    const user = userEvent.setup();
    renderAt("/messages/5");

    await user.click(await screen.findByRole("button", { name: "Показать более ранние" }));

    const oldest = await screen.findByText("первое");
    expect(fetchMessages).toHaveBeenLastCalledWith(5, 2);
    expectBefore(oldest, screen.getByText("второе"));
    expect(screen.queryByRole("button", { name: "Показать более ранние" })).not.toBeInTheDocument();
  });

  it("кнопки нет, если история помещается в одну страницу", async () => {
    vi.mocked(fetchMessages).mockResolvedValue({ messages: [msg(1, ME, "одно")], nextCursor: null });
    renderAt("/messages/5");

    await screen.findByText("одно");
    expect(screen.queryByRole("button", { name: "Показать более ранние" })).not.toBeInTheDocument();
  });
});

describe("MessagesPage: polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderFlushed(path: string) {
    let utils!: ReturnType<typeof renderAt>;
    await act(async () => {
      utils = renderAt(path);
      await vi.advanceTimersByTimeAsync(0);
    });
    return utils;
  }

  const tick = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  it("открытый диалог опрашивается каждые 4 секунды и подтягивает новые сообщения", async () => {
    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [msg(1, BOB.id, "первое")],
      nextCursor: null,
    });
    await renderFlushed("/messages/5");
    expect(screen.getByText("первое")).toBeInTheDocument();
    expect(fetchMessages).toHaveBeenCalledTimes(1);

    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [msg(2, BOB.id, "второе"), msg(1, BOB.id, "первое")],
      nextCursor: null,
    });
    await tick(4000);

    expect(fetchMessages).toHaveBeenCalledTimes(2);
    expect(screen.getByText("второе")).toBeInTheDocument();
  });

  it("не помечает прочитанным повторно, пока нет новых входящих", async () => {
    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [msg(1, BOB.id, "первое")],
      nextCursor: null,
    });
    await renderFlushed("/messages/5");
    await tick(8000);

    expect(fetchMessages).toHaveBeenCalledTimes(3);
    expect(markConversationRead).toHaveBeenCalledTimes(1);
  });

  it("список диалогов обновляется каждые 10 секунд", async () => {
    await renderFlushed("/messages");
    expect(fetchConversations).toHaveBeenCalledTimes(1);

    vi.mocked(fetchConversations).mockResolvedValue({
      conversations: [conv({ otherUser: ALICE })],
    });
    await tick(10000);

    expect(fetchConversations).toHaveBeenCalledTimes(2);
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("после размонтирования опрос прекращается", async () => {
    const { unmount } = await renderFlushed("/messages/5");
    unmount();
    const convCalls = vi.mocked(fetchConversations).mock.calls.length;
    const msgCalls = vi.mocked(fetchMessages).mock.calls.length;

    await tick(20000);

    expect(fetchConversations).toHaveBeenCalledTimes(convCalls);
    expect(fetchMessages).toHaveBeenCalledTimes(msgCalls);
  });
});