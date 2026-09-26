import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorSettingsModal } from "./EditorSettingsModal";

describe("EditorSettingsModal", () => {
  it("pre-selects the currentMode radio", () => {
    render(<EditorSettingsModal currentMode="markdown" onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/WYSIWYG/)).not.toBeChecked();
    expect(screen.getByLabelText(/Markdown/)).toBeChecked();
  });

  it("switches selection when the other radio is clicked", async () => {
    const user = userEvent.setup();
    render(<EditorSettingsModal currentMode="markdown" onSave={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByLabelText(/WYSIWYG/));
    expect(screen.getByLabelText(/WYSIWYG/)).toBeChecked();
    expect(screen.getByLabelText(/Markdown/)).not.toBeChecked();
  });

  it("calls onSave with the selected mode and onClose on Сохранить", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<EditorSettingsModal currentMode="markdown" onSave={onSave} onClose={onClose} />);
    await user.click(screen.getByLabelText(/WYSIWYG/));
    await user.click(screen.getByText("Сохранить"));
    expect(onSave).toHaveBeenCalledWith("wysiwyg");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls only onClose on Отменить", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<EditorSettingsModal currentMode="wysiwyg" onSave={onSave} onClose={onClose} />);
    await user.click(screen.getByText("Отменить"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<EditorSettingsModal currentMode="wysiwyg" onSave={vi.fn()} onClose={onClose} />);
    await user.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the modal card", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EditorSettingsModal currentMode="wysiwyg" onSave={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByText("Настройки редактора"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close on a help-icon click (stopPropagation)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EditorSettingsModal currentMode="wysiwyg" onSave={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByTitle("Справка по редактору WYSIWYG"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("help icons point to the correct help pages", () => {
    render(<EditorSettingsModal currentMode="wysiwyg" onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTitle("Справка по редактору WYSIWYG")).toHaveAttribute("href", "/docs/help/wysiwyg");
    expect(screen.getByTitle("Справка по разметке Markdown")).toHaveAttribute("href", "/docs/help/markdown");
  });
});