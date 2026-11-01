import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageMenu } from "./MessageMenu";

const renderMenu = (props: Partial<React.ComponentProps<typeof MessageMenu>> = {}) =>
  render(
    <MessageMenu
      anchor={new DOMRect(10, 10, 100, 30)}
      mine={false}
      onReply={vi.fn()}
      onForward={vi.fn()}
      onDeleteForMe={vi.fn()}
      onDeleteForAll={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );

describe("MessageMenu: «Пожаловаться»", () => {
  it("пункта нет по умолчанию", () => {
    renderMenu();
    expect(screen.queryByRole("menuitem", { name: /Пожаловаться/ })).not.toBeInTheDocument();
  });

  it("пункт есть при canReport и вызывает onReport", async () => {
    const onReport = vi.fn();
    renderMenu({ canReport: true, onReport });
    await userEvent.click(screen.getByRole("menuitem", { name: /Пожаловаться/ }));
    expect(onReport).toHaveBeenCalledTimes(1);
  });
});