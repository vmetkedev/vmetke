import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteConversationModal } from "./DeleteConversationModal";

function setup(props: Partial<ComponentProps<typeof DeleteConversationModal>> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(
    <DeleteConversationModal
      open
      userName="alice"
      onClose={onClose}
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onClose, onConfirm };
}

describe("DeleteConversationModal", () => {
  it("renders nothing when closed", () => {
    setup({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the user name and both delete options", () => {
    setup();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /удалить у меня/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /удалить у всех/i })).toBeInTheDocument();
  });

  it("confirms deletion only for me", async () => {
    const { onConfirm } = setup();
    await userEvent.click(screen.getByRole("button", { name: /удалить у меня/i }));
    expect(onConfirm).toHaveBeenCalledWith("me");
  });

  it("confirms deletion for everyone", async () => {
    const { onConfirm } = setup();
    await userEvent.click(screen.getByRole("button", { name: /удалить у всех/i }));
    expect(onConfirm).toHaveBeenCalledWith("all");
  });

  it("closes via cancel, Escape and backdrop click, but not on clicks inside", async () => {
    const { onClose } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);

    await userEvent.click(screen.getByText("Удалить диалог?"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("shows an error message", () => {
    setup({ error: "Диалог не найден" });
    expect(screen.getByText("Диалог не найден")).toBeInTheDocument();
  });

  it("disables actions and ignores Escape while busy", async () => {
    const { onClose } = setup({ busy: true });
    expect(screen.getByRole("button", { name: /удалить у меня/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /удалить у всех/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();

    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});