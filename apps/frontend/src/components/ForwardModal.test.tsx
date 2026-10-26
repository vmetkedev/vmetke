import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./Avatar", () => ({ Avatar: () => null }));

import { ForwardModal } from "./ForwardModal";
import type { Conversation, ConversationUser } from "../lib/messages";

const BOB: ConversationUser = { id: "bob-id", username: "bob", displayName: "Боб", avatarColor: 1 };
const ALICE: ConversationUser = { id: "alice-id", username: "alice", displayName: null, avatarColor: 2 };

const conv = (id: number, otherUser: ConversationUser): Conversation => ({
  id,
  otherUser,
  lastMessage: { id: 1, content: "x", senderId: otherUser.id, createdAt: "t", deleted: false },
  unreadCount: 0,
});

function setup(over: Partial<React.ComponentProps<typeof ForwardModal>> = {}) {
  const props = {
    conversations: [conv(5, BOB), conv(6, ALICE)],
    preview: "пересылаемый текст",
    busy: false,
    error: null as string | null,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...over,
  };
  render(<ForwardModal {...props} />);
  return props;
}

const confirmButton = () => screen.getByRole("button", { name: /Переслать$|Отправка/ });

describe("ForwardModal", () => {
  it("показывает превью и диалоги, а кнопка неактивна, пока ничего не выбрано", () => {
    setup();

    expect(screen.getByText("пересылаемый текст")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Боб/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /alice/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Переслать" })).toBeDisabled();
  });

  it("выбор диалога и подтверждение вызывают onConfirm с id диалога", async () => {
    const p = setup();
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: /alice/ }));
    expect(screen.getByRole("radio", { name: /alice/ })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "Переслать" }));

    expect(p.onConfirm).toHaveBeenCalledWith(6);
  });

  it("выбрать можно только один диалог", async () => {
    setup();
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: /Боб/ }));
    await user.click(screen.getByRole("radio", { name: /alice/ }));

    expect(screen.getByRole("radio", { name: /Боб/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: /alice/ })).toHaveAttribute("aria-checked", "true");
  });

  it("поиск фильтрует по имени и по username", async () => {
    setup();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Поиск по диалогам"), "бо");
    expect(screen.getByRole("radio", { name: /Боб/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /alice/ })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Поиск по диалогам"));
    await user.type(screen.getByLabelText("Поиск по диалогам"), "ALI");
    expect(screen.getByRole("radio", { name: /alice/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Боб/ })).not.toBeInTheDocument();
  });

  it("показывает «Ничего не найдено», если поиск ничего не дал", async () => {
    setup();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Поиск по диалогам"), "zzz");

    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
  });

  it("показывает заглушку, если диалогов нет", () => {
    setup({ conversations: [] });

    expect(screen.getByText(/Нет диалогов/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Переслать" })).toBeDisabled();
  });

  it("при отправке блокирует кнопки и не закрывается по Escape", async () => {
    const p = setup({ busy: true });
    const user = userEvent.setup();

    expect(confirmButton()).toHaveTextContent("Отправка...");
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it("показывает ошибку", () => {
    setup({ error: "Диалог не найден" });

    expect(screen.getByRole("alert")).toHaveTextContent("Диалог не найден");
  });

  it("закрывается по Escape, по «Отмена» и по клику на фон", async () => {
    const p = setup();
    const user = userEvent.setup();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Отмена" }));
    await user.click(screen.getByRole("dialog").parentElement as HTMLElement);

    expect(p.onClose).toHaveBeenCalledTimes(3);
  });

  it("клик внутри окна не закрывает его", async () => {
    const p = setup();
    const user = userEvent.setup();

    await user.click(screen.getByRole("dialog"));

    expect(p.onClose).not.toHaveBeenCalled();
  });
});