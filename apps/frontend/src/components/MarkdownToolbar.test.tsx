import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { MarkdownToolbar } from "./MarkdownToolbar";

function Harness({ initial = "", onChangeSpy }: { initial?: string; onChangeSpy: (v: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(initial);
  return (
    <div>
      <textarea data-testid="textarea" ref={textareaRef} value={content} onChange={() => {}} />
      <MarkdownToolbar
        textareaRef={textareaRef}
        content={content}
        onChange={(v) => {
          setContent(v);
          onChangeSpy(v);
        }}
      />
    </div>
  );
}

function selectAll(textarea: HTMLTextAreaElement) {
  textarea.focus();
  textarea.setSelectionRange(0, textarea.value.length);
}

function caretAtStart(textarea: HTMLTextAreaElement) {
  textarea.focus();
  textarea.setSelectionRange(0, 0);
}

describe("MarkdownToolbar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("wraps a selection in bold markers", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<Harness initial="привет" onChangeSpy={onChangeSpy} />);
    selectAll(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Текст"));
    await user.click(screen.getByTitle("Жирный"));
    expect(onChangeSpy).toHaveBeenCalledWith("**привет**");
  });

  it("inserts placeholder text for bold when nothing is selected", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);
    caretAtStart(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Текст"));
    await user.click(screen.getByTitle("Жирный"));
    expect(onChangeSpy).toHaveBeenCalledWith("**текст**");
  });

  it("wraps a selection with italic/underline/strike/sub/superscript markers", async () => {
    const user = userEvent.setup();
    const cases: [string, string][] = [
      ["Курсив", "*слово*"],
      ["Подчёркнутый", "<u>слово</u>"],
      ["Зачёркнутый", "~~слово~~"],
      ["Подстрочный", "<sub>слово</sub>"],
      ["Надстрочный", "<sup>слово</sup>"],
    ];
    for (const [label, expected] of cases) {
      const onChangeSpy = vi.fn();
      const { unmount } = render(<Harness initial="слово" onChangeSpy={onChangeSpy} />);
      selectAll(screen.getByTestId("textarea") as HTMLTextAreaElement);
      await user.click(screen.getByTitle("Текст"));
      await user.click(screen.getByTitle(label));
      expect(onChangeSpy).toHaveBeenCalledWith(expected);
      unmount();
    }
  });

  it("strips formatting markers via the eraser button", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<Harness initial="**жирный** и *курсив*" onChangeSpy={onChangeSpy} />);
    selectAll(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Текст"));
    await user.click(screen.getByTitle("Очистить форматирование"));
    expect(onChangeSpy).toHaveBeenCalledWith("жирный и курсив");
  });

  it("applies a heading prefix", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<Harness initial="Заголовок статьи" onChangeSpy={onChangeSpy} />);
    selectAll(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Заголовок"));
    await user.click(screen.getByText("H2"));
    expect(onChangeSpy).toHaveBeenCalledWith("## Заголовок статьи");
  });

  it("prefixes the selection with a blockquote marker", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<Harness initial="важное" onChangeSpy={onChangeSpy} />);
    selectAll(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Цитата"));
    expect(onChangeSpy).toHaveBeenCalledWith("> важное");
  });

  it("applies bullet and ordered list prefixes", async () => {
    const user = userEvent.setup();
    let onChangeSpy = vi.fn();
    let unmount: () => void;

    ({ unmount } = render(<Harness initial="пункт" onChangeSpy={onChangeSpy} />));
    selectAll(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Список"));
    await user.click(screen.getByTitle("Маркированный список"));
    expect(onChangeSpy).toHaveBeenCalledWith("- пункт");
    unmount();

    onChangeSpy = vi.fn();
    ({ unmount } = render(<Harness initial="пункт" onChangeSpy={onChangeSpy} />));
    selectAll(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Список"));
    await user.click(screen.getByTitle("Нумерованный список"));
    expect(onChangeSpy).toHaveBeenCalledWith("1. пункт");
  });

  it("inserts an image markdown link from window.prompt", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("https://example.com/pic.png");
    const onChangeSpy = vi.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);
    caretAtStart(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Изображение"));
    expect(onChangeSpy).toHaveBeenCalledWith("![](https://example.com/pic.png)");
  });

  it("does not insert an image when the prompt is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue(null);
    const onChangeSpy = vi.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);
    caretAtStart(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Изображение"));
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it("inserts a markdown table skeleton", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);
    caretAtStart(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Таблица"));
    expect(onChangeSpy).toHaveBeenCalledWith("| A | B |\n| - | - |\n| 1 | 2 |");
  });

  it("inserts a horizontal rule", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);
    caretAtStart(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Разделитель"));
    expect(onChangeSpy).toHaveBeenCalledWith("\n---\n");
  });

  it("wraps a selection in inline and block code markers", async () => {
    const user = userEvent.setup();
    let onChangeSpy = vi.fn();
    let unmount: () => void;

    ({ unmount } = render(<Harness initial="код" onChangeSpy={onChangeSpy} />));
    selectAll(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Код"));
    await user.click(screen.getByTitle("Код в строке"));
    expect(onChangeSpy).toHaveBeenCalledWith("`код`");
    unmount();

    onChangeSpy = vi.fn();
    ({ unmount } = render(<Harness initial="код" onChangeSpy={onChangeSpy} />));
    selectAll(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Код"));
    await user.click(screen.getByTitle("Блок кода"));
    expect(onChangeSpy).toHaveBeenCalledWith("```\nкод\n```");
  });

  it("wraps a selection in block and inline formula markers", async () => {
    const user = userEvent.setup();
    let onChangeSpy = vi.fn();
    let unmount: () => void;

    ({ unmount } = render(<Harness initial="x^2" onChangeSpy={onChangeSpy} />));
    selectAll(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Формула"));
    await user.click(screen.getByTitle("Формула (блок)"));
    expect(onChangeSpy).toHaveBeenCalledWith("$$\nx^2\n$$");
    unmount();

    onChangeSpy = vi.fn();
    ({ unmount } = render(<Harness initial="x^2" onChangeSpy={onChangeSpy} />));
    selectAll(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Формула"));
    await user.click(screen.getByTitle("Формула (в строке)"));
    expect(onChangeSpy).toHaveBeenCalledWith("$x^2$");
  });

  it("wraps a selection in a spoiler container", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<Harness initial="секрет" onChangeSpy={onChangeSpy} />);
    selectAll(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Спойлер"));
    expect(onChangeSpy).toHaveBeenCalledWith("::: spoiler Спойлер\nсекрет\n:::");
  });

  it("inserts an anchor marker using the trimmed name from window.prompt", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("  section-1  ");
    const onChangeSpy = vi.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);
    caretAtStart(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Якорь"));
    expect(onChangeSpy).toHaveBeenCalledWith("{#section-1}");
  });

  it("does not insert an anchor marker when the prompt is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue(null);
    const onChangeSpy = vi.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);
    caretAtStart(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Якорь"));
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it("inserts an @ mention trigger", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);
    caretAtStart(screen.getByTestId("textarea") as HTMLTextAreaElement);
    await user.click(screen.getByTitle("Персона"));
    expect(onChangeSpy).toHaveBeenCalledWith("@");
  });
});