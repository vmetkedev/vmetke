import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageMenu } from "./MessageMenu";

const anchor = { top: 100, bottom: 130, left: 50, right: 250 } as DOMRect;

function setup(mine: boolean) {
  const props = {
    anchor,
    mine,
    onDeleteForMe: vi.fn(),
    onDeleteForAll: vi.fn(),
    onClose: vi.fn(),
  };
  render(<MessageMenu {...props} />);
  return props;
}

describe("MessageMenu", () => {
  it("shows only «Удалить» at first", () => {
    setup(true);
    expect(screen.getByRole("menuitem", { name: "Удалить" })).toBeInTheDocument();
    expect(screen.queryByText("Удалить у меня")).not.toBeInTheDocument();
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
  });

  it("closes on Escape and on outside click", async () => {
    const p = setup(true);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(document.body);
    expect(p.onClose).toHaveBeenCalledTimes(2);
  });
});