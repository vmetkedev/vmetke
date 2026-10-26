import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageMenu } from "./MessageMenu";

const anchor = { top: 100, bottom: 130, left: 50, right: 250 } as DOMRect;

function setup(mine: boolean, opts: { canReply?: boolean; canEdit?: boolean } = {}) {
  const props = {
    anchor,
    mine,
    canReply: opts.canReply ?? true,
    canEdit: opts.canEdit ?? false,
    onReply: vi.fn(),
    onForward: vi.fn(),
    onEdit: vi.fn(),
    onDeleteForMe: vi.fn(),
    onDeleteForAll: vi.fn(),
    onClose: vi.fn(),
  };
  render(<MessageMenu {...props} />);
  return props;
}

describe("MessageMenu", () => {
  it("shows «Ответить», «Переслать» and «Удалить» at first", () => {
    setup(true);
    expect(screen.getByRole("menuitem", { name: "Ответить" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Переслать" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Удалить" })).toBeInTheDocument();
    expect(screen.queryByText("Удалить у меня")).not.toBeInTheDocument();
  });

  it("«Ответить» calls onReply", async () => {
    const p = setup(false);
    await userEvent.click(screen.getByRole("menuitem", { name: "Ответить" }));
    expect(p.onReply).toHaveBeenCalledTimes(1);
  });

  it("«Переслать» calls onForward", async () => {
    const p = setup(false);
    await userEvent.click(screen.getByRole("menuitem", { name: "Переслать" }));
    expect(p.onForward).toHaveBeenCalledTimes(1);
  });

  it("hides «Ответить» when replying is not possible", () => {
    setup(true, { canReply: false });
    expect(screen.queryByRole("menuitem", { name: "Ответить" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Переслать" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Удалить" })).toBeInTheDocument();
  });

  it("shows «Изменить» only when editing is allowed and calls onEdit", async () => {
    const p = setup(true, { canEdit: true });
    await userEvent.click(screen.getByRole("menuitem", { name: "Изменить" }));
    expect(p.onEdit).toHaveBeenCalledTimes(1);
  });

  it("hides «Изменить» by default", () => {
    setup(true);
    expect(screen.queryByRole("menuitem", { name: "Изменить" })).not.toBeInTheDocument();
  });

  it("own message: submenu offers delete for me and for everyone", async () => {
    const p = setup(true);
    await userEvent.click(screen.getByRole("menuitem", { name: "Удалить" }));
    await userEvent.click(screen.getByText("Удалить у меня"));
    expect(p.onDeleteForMe).toHaveBeenCalledTimes(1);
  });

  it("own message: delete for everyone calls handler", async () => {
    const p = setup(true);
    await userEvent.click(screen.getByRole("menuitem", { name: "Удалить" }));
    await userEvent.click(screen.getByText("Удалить у всех"));
    expect(p.onDeleteForAll).toHaveBeenCalledTimes(1);
  });

  it("foreign message: no «Удалить у всех»", async () => {
    setup(false);
    await userEvent.click(screen.getByRole("menuitem", { name: "Удалить" }));
    expect(screen.getByText("Удалить у меня")).toBeInTheDocument();
    expect(screen.queryByText("Удалить у всех")).not.toBeInTheDocument();
  });

  it("«Назад» returns to the main menu", async () => {
    setup(true);
    await userEvent.click(screen.getByRole("menuitem", { name: "Удалить" }));
    await userEvent.click(screen.getByText("Назад"));
    expect(screen.queryByText("Удалить у меня")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Ответить" })).toBeInTheDocument();
  });

  it("closes on Escape and on outside click", async () => {
    const p = setup(true);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(document.body);
    expect(p.onClose).toHaveBeenCalledTimes(2);
  });
});