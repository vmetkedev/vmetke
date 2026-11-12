import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportDialog } from "./ReportDialog";

const { mockSubmit } = vi.hoisted(() => ({ mockSubmit: vi.fn() }));
vi.mock("../lib/reports", async (orig) => ({
  ...(await orig<typeof import("../lib/reports")>()),
  submitReport: mockSubmit,
}));

const onClose = vi.fn();
const renderDialog = (targetType: "post" | "comment" | "user" | "message" = "post", targetId = "p1") =>
  render(<ReportDialog targetType={targetType} targetId={targetId} onClose={onClose} />);

beforeEach(() => {
  mockSubmit.mockReset();
  onClose.mockReset();
});

describe("ReportDialog", () => {
  it("заголовок по типу цели, четыре причины, по умолчанию «спам»", () => {
    renderDialog("comment");
    expect(screen.getByRole("dialog", { name: "Пожаловаться на комментарий" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByLabelText("Спам или реклама")).toBeChecked();
  });

  it("для сообщения объясняет, что увидят модераторы", () => {
    renderDialog("message", "42");
    expect(screen.getByText(/несколько предыдущих сообщений/)).toBeInTheDocument();
  });

  it("для поста такой подсказки нет", () => {
    renderDialog("post");
    expect(screen.queryByText(/несколько предыдущих сообщений/)).not.toBeInTheDocument();
  });

  it("отправляет выбранную причину и обрезанный комментарий", async () => {
    mockSubmit.mockResolvedValue(undefined);
    renderDialog("post", "p1");
    await userEvent.click(screen.getByLabelText("Оскорбления или травля"));
    await userEvent.type(screen.getByLabelText(/Комментарий/), "  грубит  ");
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(mockSubmit).toHaveBeenCalledWith({
      targetType: "post",
      targetId: "p1",
      reason: "abuse",
      comment: "грубит",
    });
  });

  it("для «Другое» комментарий обязателен (от 3 символов)", async () => {
    renderDialog();
    await userEvent.click(screen.getByLabelText("Другое"));
    const submit = screen.getByRole("button", { name: "Отправить" });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Комментарий/), "ab");
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Комментарий/), "c");
    expect(submit).toBeEnabled();
  });

  it("после отправки показывает подтверждение и закрывается кнопкой", async () => {
    mockSubmit.mockResolvedValue(undefined);
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));
    expect(await screen.findByText(/Жалоба отправлена/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("ошибка сервера показывается в диалоге, можно отправить снова", async () => {
    mockSubmit.mockRejectedValue(new Error("Вы уже отправили жалобу, она на рассмотрении"));
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));
    expect(await screen.findByText("Вы уже отправили жалобу, она на рассмотрении")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отправить" })).toBeEnabled();
  });

  it("Escape закрывает диалог", async () => {
    renderDialog();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});