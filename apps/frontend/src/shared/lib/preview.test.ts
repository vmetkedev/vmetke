import { describe, it, expect } from "vitest";
import { truncateMarkdown } from "./preview";

describe("truncateMarkdown", () => {
  it("не режет короткий текст", () => {
    expect(truncateMarkdown("привет", 500)).toEqual({ text: "привет", truncated: false });
  });

  it("режет длинный текст по лимиту", () => {
    const r = truncateMarkdown("а".repeat(600), 500);
    expect(r.truncated).toBe(true);
    expect(r.text).toBe("а".repeat(500) + "…");
  });

  it("не считает ссылку на картинку в лимит", () => {
    const img = "![x](https://example.com/" + "a".repeat(300) + ".png)";
    const r = truncateMarkdown("а".repeat(400) + img + "б".repeat(100), 500);
    expect(r.truncated).toBe(false);
    expect(r.text).toContain(img);
  });

  it("не режет картинку посередине", () => {
    const img = "![x](https://example.com/a.png)";
    const r = truncateMarkdown("а".repeat(10) + img + "б".repeat(600), 500);
    expect(r.text).toContain(img);
    expect(r.truncated).toBe(true);
  });

  it("URL ссылки не входит в лимит и ссылка не режется", () => {
    const url = "https://doc.qt.io/very/long/url/that/goes/on/and/on";
    const r = truncateMarkdown("а".repeat(490) + ` [поддержка](${url}) и далее ` + "б".repeat(100), 500);
    expect(r.truncated).toBe(true);
    expect(r.text).toContain(`[поддержка](${url})`);
    expect(r.text.endsWith("…")).toBe(true);
  });

  it("обрезает подпись ссылки, но оставляет URL целиком", () => {
    const r = truncateMarkdown("а".repeat(495) + " [поддержка](https://x.io)", 500);
    expect(r.truncated).toBe(true);
    expect(r.text).toContain("[подд](https://x.io)…");
  });

  it("не режет формулу посередине", () => {
    const r = truncateMarkdown("а".repeat(495) + " $E=mc^2+\\frac{a}{b}$", 500);
    expect(r.truncated).toBe(true);
    expect(r.text).toBe("а".repeat(495) + "…");
  });

  it("закрывает незакрытый жирный", () => {
    const r = truncateMarkdown("**" + "а".repeat(600) + "**", 500);
    expect(r.text).toBe("**" + "а".repeat(498) + "…**");
  });

  it("закрывает зачёркнутый и не дублирует маркер на границе", () => {
    const r = truncateMarkdown("а".repeat(498) + " ~~" + "б".repeat(50) + "~~", 500);
    expect(r.text.match(/~~/g)?.length ?? 0).toBe(0);
  });

  it("закрывает обрезанный блок кода", () => {
    const code = "```\n" + "x".repeat(100) + "\n" + ("y".repeat(100) + "\n").repeat(10) + "```";
    const r = truncateMarkdown(code, 500);
    expect(r.truncated).toBe(true);
    expect(r.text.match(/```/g)?.length).toBe(2);
    expect(r.text.endsWith("```\n\n…")).toBe(true);
  });

  it("экранированные символы не ломают подсчёт маркеров", () => {
    const r = truncateMarkdown("\\*" + "а".repeat(600), 500);
    expect(r.text.startsWith("\\*")).toBe(true);
    expect(r.text.endsWith("…")).toBe(true);
  });
});