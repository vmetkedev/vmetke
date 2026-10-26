import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  editMessage,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  sendMessage,
  type Conversation,
  type ConversationUser,
  type Message,
  type ReplyPreview,
} from "../lib/messages";
import MessagesPage from "./MessagesPage";

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
  editMessage: vi.fn(),
  markConversationRead: vi.fn(),
}));


const BOB: ConversationUser = { id: "bob-id", username: "bob", displayName: "Боб", avatarColor: 1 };
const ALICE: ConversationUser = { id: "alice-id", username: "alice", displayName: null, avatarColor: 2 };

const now = () => new Date().toISOString();

const msg = (
  id: number,
  senderId: string,
  content: string,
  conversationId = 5,
  replyTo: ReplyPreview | null = null,
): Message => ({
  id,
  conversationId,
  senderId,
  content,
  createdAt: now(),
  deleted: false,
  replyTo,
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
const cancelReplyButton = () => screen.getByRole("button", { name: "Отменить ответ" });
const queryCancelReply = () => screen.queryByRole("button", { name: "Отменить ответ" });

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

describe("MessagesPage: ответы", () => {
  async function openReplyBar(user: ReturnType<typeof userEvent.setup>) {
    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [msg(1, BOB.id, "оригинал")],
      nextCursor: null,
    });
    renderAt({ pathname: "/messages/5", state: { otherUser: BOB } });

    await user.click(await screen.findByText("оригинал"));
    await user.click(screen.getByRole("menuitem", { name: "Ответить" }));
  }

  it("«Ответить» в меню показывает плашку с автором и текстом и фокусирует поле ввода", async () => {
    const user = userEvent.setup();
    await openReplyBar(user);

    const bar = cancelReplyButton().parentElement as HTMLElement;
    expect(within(bar).getByText("Боб")).toBeInTheDocument();
    expect(within(bar).getByText("оригинал")).toBeInTheDocument();
    expect(input()).toHaveFocus();
    // меню после выбора закрывается
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("крестик убирает плашку, дальше сообщение уходит без replyToId", async () => {
    vi.mocked(sendMessage).mockResolvedValue(msg(2, ME, "обычное"));
    const user = userEvent.setup();
    await openReplyBar(user);

    await user.click(cancelReplyButton());
    expect(queryCancelReply()).not.toBeInTheDocument();

    await user.type(input(), "обычное");
    await user.click(sendButton());

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(5, "обычное"));
  });

  it("Escape в поле ввода убирает плашку", async () => {
    const user = userEvent.setup();
    await openReplyBar(user);

    await user.keyboard("{Escape}");

    expect(queryCancelReply()).not.toBeInTheDocument();
  });

  it("отправка с плашкой передаёт id оригинала и убирает плашку", async () => {
    vi.mocked(sendMessage).mockResolvedValue(msg(2, ME, "ответ", 5, {
      id: 1,
      senderId: BOB.id,
      content: "оригинал",
      deleted: false,
    }));
    const user = userEvent.setup();
    await openReplyBar(user);

    await user.type(input(), "ответ");
    await user.click(sendButton());

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(5, "ответ", 1));
    await waitFor(() => expect(queryCancelReply()).not.toBeInTheDocument());
    // новое сообщение сразу показывается с цитатой
    expect(await screen.findByText("ответ")).toBeInTheDocument();
  });

  it("рисует цитату в пузыре: чужое сообщение подписано «Собеседник», своё «Вы»", async () => {
    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [
        msg(4, BOB.id, "ответ боба", 5, { id: 3, senderId: ME, content: "моя мысль", deleted: false }),
        msg(2, ME, "мой ответ", 5, { id: 1, senderId: BOB.id, content: "чужая мысль", deleted: false }),
      ],
      nextCursor: null,
    });
    renderAt("/messages/5");

    expect(await screen.findByText("чужая мысль")).toBeInTheDocument();
    expect(screen.getByText("моя мысль")).toBeInTheDocument();
    expect(screen.getByText("Собеседник")).toBeInTheDocument();
    expect(screen.getByText("Вы")).toBeInTheDocument();
  });

  it("цитата удалённого оригинала показывает «Сообщение удалено» без текста", async () => {
    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [
        msg(2, ME, "мой ответ", 5, { id: 1, senderId: null, content: "", deleted: true }),
      ],
      nextCursor: null,
    });
    renderAt("/messages/5");

    expect(await screen.findByText("Сообщение удалено")).toBeInTheDocument();
    expect(screen.getByText("мой ответ")).toBeInTheDocument();
  });

  it("клик по цитате не открывает меню сообщения", async () => {
    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [
        msg(2, ME, "мой ответ", 5, { id: 1, senderId: BOB.id, content: "цитата", deleted: false }),
      ],
      nextCursor: null,
    });
    const user = userEvent.setup();
    renderAt("/messages/5");

    // оригинала нет в загруженной истории: scrollToMessage ничего не находит и молча выходит
    await user.click(await screen.findByText("цитата"));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("MessagesPage: редактирование", () => {
  const cancelEditButton = () => screen.getByRole("button", { name: "Отменить редактирование" });
  const queryCancelEdit = () => screen.queryByRole("button", { name: "Отменить редактирование" });
  const saveButton = () => screen.getByRole("button", { name: "Сохранить" });

  async function renderConversation(user: ReturnType<typeof userEvent.setup>) {
    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [msg(2, ME, "моё"), msg(1, BOB.id, "чужое")],
      nextCursor: null,
    });
    renderAt({ pathname: "/messages/5", state: { otherUser: BOB } });
    await screen.findByText("моё");
    return user;
  }

  async function startEdit(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByText("моё"));
    await user.click(screen.getByRole("menuitem", { name: "Изменить" }));
  }

  it("«Изменить» есть только у своих сообщений", async () => {
    const user = await renderConversation(userEvent.setup());

    await user.click(screen.getByText("чужое"));
    expect(screen.getByRole("menuitem", { name: "Ответить" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Изменить" })).not.toBeInTheDocument();

    await user.click(screen.getByText("моё"));
    expect(screen.getByRole("menuitem", { name: "Изменить" })).toBeInTheDocument();
  });

  it("«Изменить» кладёт текст в поле ввода, показывает плашку и фокусирует поле", async () => {
    const user = await renderConversation(userEvent.setup());
    await startEdit(user);

    expect(input()).toHaveValue("моё");
    expect(input()).toHaveFocus();
    expect(screen.getByText("Редактирование")).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("сохранение отправляет новый текст, показывает «изменено» и возвращает черновик", async () => {
    vi.mocked(editMessage).mockResolvedValue({ ...msg(2, ME, "новое"), editedAt: now() });
    const user = await renderConversation(userEvent.setup());
    await user.type(input(), "черновик");
    await startEdit(user);

    await user.clear(input());
    await user.type(input(), "новое");
    await user.click(saveButton());

    expect(await screen.findByText("новое")).toBeInTheDocument();
    expect(editMessage).toHaveBeenCalledWith(5, 2, "новое");
    expect(screen.getByText("изменено")).toBeInTheDocument();
    expect(input()).toHaveValue("черновик");
    expect(queryCancelEdit()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отправить" })).toBeInTheDocument();
  });

  it("крестик отменяет правку и возвращает черновик", async () => {
    const user = await renderConversation(userEvent.setup());
    await user.type(input(), "черновик");
    await startEdit(user);

    await user.click(cancelEditButton());

    expect(input()).toHaveValue("черновик");
    expect(queryCancelEdit()).not.toBeInTheDocument();
    expect(editMessage).not.toHaveBeenCalled();
  });

  it("Escape отменяет правку", async () => {
    const user = await renderConversation(userEvent.setup());
    await startEdit(user);

    await user.keyboard("{Escape}");

    expect(queryCancelEdit()).not.toBeInTheDocument();
    expect(input()).toHaveValue("");
  });

  it("Enter сохраняет правку", async () => {
    vi.mocked(editMessage).mockResolvedValue({ ...msg(2, ME, "моё!"), editedAt: now() });
    const user = await renderConversation(userEvent.setup());
    await startEdit(user);

    await user.type(input(), "!{Enter}");

    await waitFor(() => expect(editMessage).toHaveBeenCalledWith(5, 2, "моё!"));
  });

  it("если текст не изменился, запрос не отправляется и правка закрывается", async () => {
    const user = await renderConversation(userEvent.setup());
    await startEdit(user);

    await user.click(saveButton());

    expect(editMessage).not.toHaveBeenCalled();
    expect(queryCancelEdit()).not.toBeInTheDocument();
  });

  it("при ошибке показывает её и остаётся в режиме правки", async () => {
    vi.mocked(editMessage).mockRejectedValue(new Error("Нельзя править"));
    const user = await renderConversation(userEvent.setup());
    await startEdit(user);

    await user.type(input(), "!");
    await user.click(saveButton());

    expect(await screen.findByText("Нельзя править")).toBeInTheDocument();
    expect(cancelEditButton()).toBeInTheDocument();
    expect(input()).toHaveValue("моё!");
  });

  it("начало ответа во время правки отменяет правку", async () => {
    const user = await renderConversation(userEvent.setup());
    await startEdit(user);

    await user.click(screen.getByText("чужое"));
    await user.click(screen.getByRole("menuitem", { name: "Ответить" }));

    expect(queryCancelEdit()).not.toBeInTheDocument();
    expect(cancelReplyButton()).toBeInTheDocument();
    expect(input()).toHaveValue("");
  });

  it("показывает «изменено» у уже отредактированного сообщения", async () => {
    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [{ ...msg(1, ME, "правленое"), editedAt: now() }],
      nextCursor: null,
    });
    renderAt("/messages/5");

    expect(await screen.findByText("изменено")).toBeInTheDocument();
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

  it("плашка ответа исчезает, если собеседник удалил оригинал", async () => {
    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [msg(1, BOB.id, "оригинал")],
      nextCursor: null,
    });
    await renderFlushed("/messages/5");

    fireEvent.click(screen.getByText("оригинал"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Ответить" }));
    expect(cancelReplyButton()).toBeInTheDocument();

    vi.mocked(fetchMessages).mockResolvedValue({
      messages: [{ ...msg(1, BOB.id, ""), deleted: true }],
      nextCursor: null,
    });
    await tick(4000);

    expect(queryCancelReply()).not.toBeInTheDocument();
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