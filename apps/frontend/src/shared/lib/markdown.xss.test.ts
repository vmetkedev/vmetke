// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { loadMarkdownEngines, renderMarkdown } from "./markdown";

const DANGEROUS_URL = /^\s*(javascript|data|vbscript):/i;

function parse(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

function expectSafe(html: string) {
  const root = parse(html);
  expect(root.querySelector("script, iframe, object, embed, style, form, input, link, meta, base")).toBeNull();
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const a of Array.from(el.attributes)) {
      expect(a.name.toLowerCase().startsWith("on")).toBe(false);
      if (a.name === "href" || a.name === "src" || a.name === "xlink:href") {
        expect(DANGEROUS_URL.test(a.value)).toBe(false);
      }
      if (a.name === "style") {
        expect(el.closest(".katex")).not.toBeNull();
      }
    }
  }
}

describe("renderMarkdown: XSS", () => {
  beforeAll(async () => {
    await loadMarkdownEngines();
  });

  it.each([
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "<svg onload=alert(1)>",
    "[x](javascript:alert(1))",
    "[x](JAVASCRIPT:alert(1))",
    "[x](data:text/html,<script>alert(1)</script>)",
    "![x](javascript:alert(1))",
    "![a{#b} onerror=alert(1)](https://e.com/x.png)",
    '![](https://e.com/@foo "t{#a} @b onmouseover=alert(1)")',
    "![x $a$](https://e.com/x.png)",
    '[x](https://e.com/"onmouseover="alert(1))',
    "[**x** @foo {#bar}](https://e.com)",
    "::: spoiler <img src=x onerror=alert(1)>\ntext\n:::",
    "| <b onclick=alert(1)>h</b> |\n|---|\n| <i onmouseover=alert(1)>c</i> |",
    "$\\href{javascript:alert(1)}{x}$",
    "$\\url{javascript:alert(1)}$",
    "$\\includegraphics{https://e.com/x.png}$",
    "$\\htmlStyle{position:fixed}{x}$",
    "$$\n\\htmlClass{x}{y}\n$$",
    '@a"onmouseover="alert(1)',
    "\u0000ESCAPED99\u0000 \u0000SLOT5\u0000 \u0000FORMULA7\u0000",
    "```\"><img src=x onerror=alert(1)>\ncode\n```",
    "```js\n</code></pre><img src=x onerror=alert(1)>\n```",
    "# <img src=x onerror=alert(1)>",
    "> <script>alert(1)</script>",
    "- <iframe src=javascript:alert(1)></iframe>",
  ])("безопасно: %j", (payload) => {
    expectSafe(renderMarkdown(payload));
  });

  it("javascript: не превращается в ссылку", () => {
    const root = parse(renderMarkdown("[x](javascript:alert(1))"));
    expect(root.querySelector("a")).toBeNull();
  });

  it("обычная ссылка открывается безопасно", () => {
    const a = parse(renderMarkdown("[текст](https://example.com/page)")).querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com/page");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("разметка внутри URL не ломает атрибуты", () => {
    const img = parse(renderMarkdown("![a](https://e.com/@foo/*bar*/{#x}.png)")).querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://e.com/@foo/*bar*/{#x}.png");
    expect(img?.getAttribute("onerror")).toBeNull();
  });

  it("форматирование и упоминания работают как раньше", () => {
    const root = parse(renderMarkdown("**жирный** *курсив* @user"));
    expect(root.querySelector("strong")?.textContent).toBe("жирный");
    expect(root.querySelector("em")?.textContent).toBe("курсив");
    expect(root.querySelector('a[href="/u/user"]')).not.toBeNull();
  });

  it("формулы KaTeX переживают очистку", () => {
    const root = parse(renderMarkdown("$x^2$"));
    expect(root.querySelector(".katex")).not.toBeNull();
  });

  it("блочные формулы KaTeX переживают очистку", () => {
    const root = parse(renderMarkdown("$$\n\\frac{a}{b}\n$$"));
    expect(root.querySelector(".katex-display, .katex")).not.toBeNull();
  });
});