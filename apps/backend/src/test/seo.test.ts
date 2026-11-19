import { describe, expect, it } from "vitest";
import {
  buildNotFoundHead,
  buildPostHead,
  firstImageUrl,
  injectHead,
  markdownToPlainText,
  truncate,
  type SeoPost,
} from "../lib/seo.js";

const SITE = "https://vmetke.ru";
const TEMPLATE =
  '<html lang="ru"><head><title>Vmetke.ru</title>' +
  '<meta name="description" content="def" data-seo-default />' +
  '<meta property="og:title" content="def" data-seo-default />' +
  '<meta charset="UTF-8" /></head><body></body></html>';

const post = (over: Partial<SeoPost> = {}): SeoPost => ({
  id: "11111111-1111-4111-8111-111111111111",
  title: "Заголовок",
  content: "Текст поста",
  tags: ["js", "web"],
  createdAt: new Date("2026-11-01T10:00:00Z"),
  author: { username: "sirdi", displayName: "Сирди" },
  ...over,
});

describe("markdownToPlainText", () => {
  it("убирает разметку и кастомные блоки", () => {
    const md =
      "# Заголовок\n\n**жирный** и ~~зачёркнутый~~ [ссылка](https://a.b) ![pic](https://a.b/i.png)\n\n" +
      "$$E=mc^2$$\n\n```ts\nconst secret = 1;\n```\n\n::: spoiler Название\nтекст\n:::\n\n- пункт";
    const text = markdownToPlainText(md);
    expect(text).toContain("жирный и зачёркнутый ссылка");
    expect(text).toContain("пункт");
    for (const junk of ["**", "~~", "https://a.b", "E=mc", "secret", ":::", "#"]) {
      expect(text).not.toContain(junk);
    }
  });

  it("снимает экранирование", () => {
    expect(markdownToPlainText("\\[таблица\\]")).toBe("[таблица]");
  });
});

describe("truncate", () => {
  it("не трогает короткий текст", () => {
    expect(truncate("коротко", 50)).toBe("коротко");
  });
  it("режет по слову и добавляет многоточие", () => {
    const out = truncate("один два три четыре пять шесть", 20);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(21);
  });
});

describe("firstImageUrl", () => {
  it("берёт абсолютную ссылку, в том числе с title", () => {
    expect(firstImageUrl('a ![x](https://i.ru/1.png "t") b', SITE)).toBe("https://i.ru/1.png");
  });
  it("превращает /uploads/ в абсолютный URL", () => {
    expect(firstImageUrl("![x](/uploads/a.png)", SITE)).toBe("https://vmetke.ru/uploads/a.png");
  });
  it("игнорирует прочие относительные пути и отсутствие картинок", () => {
    expect(firstImageUrl("![x](../a.png)", SITE)).toBeNull();
    expect(firstImageUrl("просто текст", SITE)).toBeNull();
  });
});

describe("buildPostHead + injectHead", () => {
  it("ставит title, canonical, og и убирает дефолтные теги", () => {
    const html = injectHead(TEMPLATE, buildPostHead(post(), SITE));
    expect(html).toContain("<title>Заголовок | Vmetke.ru</title>");
    expect(html).toContain(`rel="canonical" href="${SITE}/post/${post().id}"`);
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain('property="article:tag" content="web"');
    expect(html).not.toContain('content="def"');
    expect(html).toContain('<meta charset="UTF-8" />');
  });

  it("не интерпретирует $-шаблоны replace в тексте поста", () => {
    const html = injectHead(TEMPLATE, buildPostHead(post({ title: "Цена $1 и $& тест" }), SITE));
    expect(html).toContain("<title>Цена $1 и $&amp; тест | Vmetke.ru</title>");
  });

  it("экранирует HTML и не даёт закрыть JSON-LD через </script>", () => {
    const html = injectHead(
      TEMPLATE,
      buildPostHead(post({ title: '</script><img src=x onerror="1">' }), SITE)
    );
    expect(html).not.toContain("<img src=x");
    expect(html.match(/<\/script>/g)?.length).toBe(1);
  });

  it("использует картинку поста и summary_large_image", () => {
    const html = injectHead(
      TEMPLATE,
      buildPostHead(post({ content: "![a](https://i.ru/1.png)\n\nтекст" }), SITE)
    );
    expect(html).toContain('property="og:image" content="https://i.ru/1.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it("без картинки берёт иконку сайта", () => {
    const html = injectHead(TEMPLATE, buildPostHead(post(), SITE));
    expect(html).toContain(`property="og:image" content="${SITE}/icon-512.png"`);
  });

  it("без заголовка берёт начало текста, а не 'null'", () => {
    const html = injectHead(
      TEMPLATE,
      buildPostHead(post({ title: null, content: "Короткая заметка без заголовка" }), SITE)
    );
    expect(html).toContain("<title>Короткая заметка без заголовка | Vmetke.ru</title>");
    expect(html).not.toContain("null");
  });
});

describe("buildNotFoundHead", () => {
  it("закрывает страницу от индексации", () => {
    expect(injectHead(TEMPLATE, buildNotFoundHead())).toContain("noindex");
  });
});