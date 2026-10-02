import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown — базовый инлайн-синтаксис", () => {
  it("рендерит жирный текст", () => {
    expect(renderMarkdown("**жирный**")).toBe('<p class="my-1"><strong>жирный</strong></p>');
  });

  it("рендерит курсив", () => {
    expect(renderMarkdown("*курсив*")).toBe('<p class="my-1"><em>курсив</em></p>');
  });

  it("рендерит зачёркнутый текст", () => {
    expect(renderMarkdown("~~зачёркнутый~~")).toBe('<p class="my-1"><del>зачёркнутый</del></p>');
  });

  it("рендерит инлайн-код", () => {
    expect(renderMarkdown("`код`")).toBe('<p class="my-1"><code>код</code></p>');
  });

  it("пропускает теги подчёркивания, суб- и суперскрипта как есть", () => {
    expect(renderMarkdown("<u>подчёркнутый</u>")).toBe('<p class="my-1"><u>подчёркнутый</u></p>');
    expect(renderMarkdown("H<sub>2</sub>O")).toBe('<p class="my-1">H<sub>2</sub>O</p>');
    expect(renderMarkdown("x<sup>2</sup>")).toBe('<p class="my-1">x<sup>2</sup></p>');
  });

  it("рендерит @mention как ссылку", () => {
    expect(renderMarkdown("@test")).toBe(
      '<p class="my-1"><a href="/u/test" class="text-blue-600 dark:text-blue-400 font-medium hover:underline">@test</a></p>'
    );
  });

  it("рендерит изображение по ссылке", () => {
    expect(renderMarkdown("![alt](https://example.com/x.png)")).toContain(
      '<img src="https://example.com/x.png" alt="alt"'
    );
  });

  it("рендерит картинку с title", () => {
    const html = renderMarkdown('![Alt](https://example.com/a.jpg "Подпись")**Жирный**');
    expect(html).toContain('<img src="https://example.com/a.jpg" alt="Alt" title="Подпись"');
    expect(html).toContain("<strong>Жирный</strong>");
    expect(html).not.toContain("![");
  });

  it("рендерит картинку с title отдельной строкой", () => {
    const html = renderMarkdown('![Alt](https://example.com/a.jpg "Подпись")');
    expect(html).toContain('title="Подпись"');
  });

  it("рендерит обычную ссылку", () => {
    expect(renderMarkdown("[текст](https://example.com)")).toBe(
      '<p class="my-1"><a href="https://example.com" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">текст</a></p>'
    );
  });
});

describe("renderMarkdown — backslash-escapes (CommonMark)", () => {
  it("экранированные звёздочки не становятся жирным/курсивом", () => {
    expect(renderMarkdown("\\*\\*не жирный\\*\\*")).toBe('<p class="my-1">**не жирный**</p>');
  });

  it("экранированные тильды не становятся зачёркиванием", () => {
    expect(renderMarkdown("\\~\\~не зачёркнутый\\~\\~")).toBe('<p class="my-1">~~не зачёркнутый~~</p>');
  });

  it("экранированные квадратные скобки не парсятся как ссылка", () => {
    expect(renderMarkdown("\\[table\\]")).toBe('<p class="my-1">[table]</p>');
  });

  it("экранированная обратная кавычка не становится инлайн-кодом", () => {
    expect(renderMarkdown("\\`не код\\`")).toBe('<p class="my-1">`не код`</p>');
  });

  it("экранированный @ не становится mention-ссылкой", () => {
    expect(renderMarkdown("\\@test")).toBe('<p class="my-1">@test</p>');
  });

  it("экранированный обратный слэш остаётся одиночным слэшем", () => {
    expect(renderMarkdown("путь\\\\файл")).toBe('<p class="my-1">путь\\файл</p>');
  });

  it("экранированные угловые скобки/амперсанд остаются корректно заэкранированным HTML", () => {
    expect(renderMarkdown("\\<script\\> и \\& символ")).toBe(
      '<p class="my-1">&lt;script&gt; и &amp; символ</p>'
    );
  });

  it("смешанный случай: экранированные звёздочки вокруг настоящего зачёркивания", () => {
    // \*\*\*~~авпи~~\~\~\*кпии — из реального поста пользователя
    const result = renderMarkdown("\\*\\*\\*~~авпи~~\\~\\~\\*кпии");
    expect(result).toBe('<p class="my-1">***<del>авпи</del>~~*кпии</p>');
  });

  it("не экранированные символы вне класса пунктуации остаются с обратным слэшем как есть", () => {
    // \d не входит в набор экранируемых CommonMark-символов — слэш остаётся буквально
    expect(renderMarkdown("\\d test")).toBe('<p class="my-1">\\d test</p>');
  });
});

describe("renderMarkdown — формулы не ломаются экранированием", () => {
  it("инлайн-формула рендерится нормально рядом с экранированным текстом", () => {
    const result = renderMarkdown("\\*текст\\* и $x^2$");
    expect(result).toContain("*текст*");
    expect(result).toContain("katex");
  });
});