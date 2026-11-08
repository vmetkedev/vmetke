import { describe, expect, it } from "vitest";
import {
  loadMarkdownEngines,
  markdownEnginesReady,
  markdownNeedsEngines,
  renderMarkdown,
} from "./markdown";

const CODE = "```js\nconst x = 1;\n```";

describe("markdownNeedsEngines", () => {
  it("формулы и блоки кода требуют движки", () => {
    expect(markdownNeedsEngines(CODE)).toBe(true);
    expect(markdownNeedsEngines("формула $x^2$ в тексте")).toBe(true);
    expect(markdownNeedsEngines("до\n$$\na+b\n$$\nпосле")).toBe(true);
  });

  it("обычный текст, одиночный доллар и инлайн-код не требуют", () => {
    expect(markdownNeedsEngines("просто текст **жирный**")).toBe(false);
    expect(markdownNeedsEngines("цена $5")).toBe(false);
    expect(markdownNeedsEngines("`const x = 1`")).toBe(false);
  });
});

describe("renderMarkdown до загрузки движков", () => {
  it("движки не загружены, код без подсветки, но экранирован", () => {
    expect(markdownEnginesReady()).toBe(false);
    const html = renderMarkdown("```js\nconst a = '<b>';\n```");
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("hljs-");
    expect(html).toContain("<pre");
  });

  it("формулы показываются исходным текстом, без KaTeX", () => {
    const inlineHtml = renderMarkdown("раз $x^2$ два");
    expect(inlineHtml).toContain("$x^2$");
    expect(inlineHtml).not.toContain('class="katex"');

    const blockHtml = renderMarkdown("$$\na+b\n$$");
    expect(blockHtml).toContain("a+b");
    expect(blockHtml).not.toContain('class="katex"');
  });

  it("разметка внутри формулы экранируется", () => {
    const html = renderMarkdown("$<img src=x onerror=alert(1)>$");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
  });
});

describe("renderMarkdown после загрузки движков", () => {
  it("загрузка идемпотентна, формулы и подсветка работают", async () => {
    await loadMarkdownEngines();
    await loadMarkdownEngines();
    expect(markdownEnginesReady()).toBe(true);

    expect(renderMarkdown(CODE)).toContain("hljs-keyword");
    expect(renderMarkdown("раз $x^2$ два")).toContain('class="katex"');
    expect(renderMarkdown("$$\na+b\n$$")).toContain("katex-display");
  });

  it("ошибка в формуле по-прежнему показывается", async () => {
    await loadMarkdownEngines();
    expect(renderMarkdown("$\\frac{$")).toContain("Ошибка в формуле");
  });
});