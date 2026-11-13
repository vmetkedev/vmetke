import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/core";
import { EditorToolbar } from "./EditorToolbar";

function createMockEditor(isActiveMap: Record<string, boolean> = {}) {
  const chainMethods = [
    "focus", "toggleBold", "toggleItalic", "toggleUnderline", "toggleStrike",
    "toggleSubscript", "toggleSuperscript", "unsetAllMarks", "toggleHeading",
    "toggleBlockquote", "toggleBulletList", "toggleOrderedList", "setImage",
    "insertTable", "setHorizontalRule", "toggleCode", "toggleCodeBlock", "insertContent",
  ] as const;
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of chainMethods) chain[m] = vi.fn(() => chain);
  chain.run = vi.fn();

  const editor = {
    chain: vi.fn(() => chain),
    isActive: vi.fn((name: string, attrs?: Record<string, unknown>) =>
      isActiveMap[attrs ? `${name}:${JSON.stringify(attrs)}` : name] ?? false
    ),
  };
  return { editor: editor as unknown as Editor, chain };
}

describe("EditorToolbar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("toggles bold via the Текст dropdown", async () => {
    const user = userEvent.setup();
    const { editor, chain } = createMockEditor();
    render(<EditorToolbar editor={editor} />);
    await user.click(screen.getByTitle("Текст"));
    await user.click(screen.getByTitle("Жирный"));
    expect(chain.toggleBold).toHaveBeenCalledTimes(1);
    expect(chain.run).toHaveBeenCalled();
  });

  it("toggles a heading level via the Заголовок dropdown", async () => {
    const user = userEvent.setup();
    const { editor, chain } = createMockEditor();
    render(<EditorToolbar editor={editor} />);
    await user.click(screen.getByTitle("Заголовок"));
    await user.click(screen.getByText("H2"));
    expect(chain.toggleHeading).toHaveBeenCalledWith({ level: 2 });
  });

  it("toggles blockquote directly (no dropdown)", async () => {
    const user = userEvent.setup();
    const { editor, chain } = createMockEditor();
    render(<EditorToolbar editor={editor} />);
    await user.click(screen.getByTitle("Цитата"));
    expect(chain.toggleBlockquote).toHaveBeenCalledTimes(1);
  });

  it("inserts an image from window.prompt", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("https://example.com/img.png");
    const { editor, chain } = createMockEditor();
    render(<EditorToolbar editor={editor} />);
    await user.click(screen.getByTitle("Изображение"));
    expect(chain.setImage).toHaveBeenCalledWith({ src: "https://example.com/img.png" });
  });

  it("does not insert an image when the prompt is cancelled or blank", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue(null);
    const { editor, chain } = createMockEditor();
    render(<EditorToolbar editor={editor} />);
    await user.click(screen.getByTitle("Изображение"));
    expect(chain.setImage).not.toHaveBeenCalled();
  });

  it("inserts a 3x3 table with a header row", async () => {
    const user = userEvent.setup();
    const { editor, chain } = createMockEditor();
    render(<EditorToolbar editor={editor} />);
    await user.click(screen.getByTitle("Таблица"));
    expect(chain.insertTable).toHaveBeenCalledWith({ rows: 3, cols: 3, withHeaderRow: true });
  });

  it("inserts an anchor with the trimmed name from window.prompt", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("  my-anchor  ");
    const { editor, chain } = createMockEditor();
    render(<EditorToolbar editor={editor} />);
    await user.click(screen.getByTitle("Якорь"));
    expect(chain.insertContent).toHaveBeenCalledWith({ type: "anchor", attrs: { name: "my-anchor" } });
  });

  it("inserts block and inline formulas via the Формула dropdown", async () => {
    const user = userEvent.setup();
    const { editor, chain } = createMockEditor();
    render(<EditorToolbar editor={editor} />);
    await user.click(screen.getByTitle("Формула"));
    await user.click(screen.getByTitle("Формула (блок)"));
    expect(chain.insertContent).toHaveBeenCalledWith({ type: "formula", attrs: { latex: "" } });

    await user.click(screen.getByTitle("Формула"));
    await user.click(screen.getByTitle("Формула (в строке)"));
    expect(chain.insertContent).toHaveBeenCalledWith({ type: "inlineFormula", attrs: { latex: "" } });
  });

  it("inserts a spoiler with default title and an empty paragraph", async () => {
    const user = userEvent.setup();
    const { editor, chain } = createMockEditor();
    render(<EditorToolbar editor={editor} />);
    await user.click(screen.getByTitle("Спойлер"));
    expect(chain.insertContent).toHaveBeenCalledWith({
      type: "spoiler",
      attrs: { title: "Спойлер" },
      content: [{ type: "paragraph" }],
    });
  });

  it("inserts an @ mention trigger", async () => {
    const user = userEvent.setup();
    const { editor, chain } = createMockEditor();
    render(<EditorToolbar editor={editor} />);
    await user.click(screen.getByTitle("Персона"));
    expect(chain.insertContent).toHaveBeenCalledWith("@");
  });

  it("reflects active state via styling on the dropdown triggers", () => {
    const { editor } = createMockEditor({ heading: true, bulletList: true });
    render(<EditorToolbar editor={editor} />);
    expect(screen.getByTitle("Заголовок")).toHaveClass("text-blue-600");
    expect(screen.getByTitle("Список")).toHaveClass("text-blue-600");
  });
});