import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMarkdownHtml } from "./useMarkdownHtml";

describe("useMarkdownHtml", () => {
  it("обычный текст рендерится сразу", () => {
    const { result } = renderHook(() => useMarkdownHtml("привет **мир**"));
    expect(result.current).toContain("<strong>мир</strong>");
  });

  it("код: сначала без подсветки, затем подсвечен", async () => {
    const { result } = renderHook(() => useMarkdownHtml("```js\nconst x = 1;\n```"));
    expect(result.current).not.toContain("hljs-keyword");
    await waitFor(() => expect(result.current).toContain("hljs-keyword"));
  });

  it("формула: сначала текст, затем KaTeX; смена текста пересчитывает", async () => {
    const { result, rerender } = renderHook(({ t }) => useMarkdownHtml(t), {
      initialProps: { t: "раз $x^2$ два" },
    });
    await waitFor(() => expect(result.current).toContain('class="katex"'));

    rerender({ t: "другой текст" });
    expect(result.current).toContain("другой текст");
    expect(result.current).not.toContain("katex");
  });
});