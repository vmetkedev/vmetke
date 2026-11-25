import DOMPurify, { type Config } from "dompurify";

// KaTeX и highlight.js тяжёлые (около 44% основного чанка), поэтому грузятся лениво
// отдельным чанком и только когда в тексте есть формула или блок кода.
type Heavy = typeof import("./markdownHeavy");
let heavy: Heavy | null = null;
let loading: Promise<void> | null = null;

export function markdownEnginesReady(): boolean {
  return heavy !== null;
}

/** Нужны ли тексту формулы или подсветка кода: те же признаки, что использует сам рендерер. */
export function markdownNeedsEngines(raw: string): boolean {
  return /^```|\$[^$\n]+\$|^\$\$\s*$/m.test(raw);
}

export function loadMarkdownEngines(): Promise<void> {
  if (heavy) return Promise.resolve();
  loading ??= import("./markdownHeavy")
    .then((m) => {
      heavy = m;
    })
    .catch((err) => {
      loading = null; // следующая попытка попробует снова
      throw err;
    });
  return loading;
}

function renderFormula(latex: string, displayMode: boolean): string {
  if (!heavy) {
    // Библиотека ещё не загружена: показываем исходный текст, хук перерисует после загрузки
    return displayMode
      ? '<span class="text-gray-500 dark:text-gray-400 font-mono text-xs">$$ ' +
          escapeHtml(latex) +
          " $$</span>"
      : '<span class="text-gray-500 dark:text-gray-400">$' +
          escapeHtml(latex) +
          "$</span>";
  }
  try {
    return heavy.katex.renderToString(latex, {
      throwOnError: true,
      displayMode,
      trust: false, // запрещает \href, \url, \includegraphics, \htmlStyle и т.п.
      maxSize: 10, // верхняя граница размеров (em), защита от \rule{999em}{999em}
      maxExpand: 200, // защита от бесконечных макро-расширений
    });
  } catch {
    return displayMode
      ? `<span class="text-red-500 text-xs">Ошибка в формуле: ${escapeHtml(latex)}</span>`
      : '<span class="text-red-500 text-xs">Ошибка в формуле</span>';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightCode(code: string, lang: string): string {
  const language = lang.toLowerCase();
  const hljs = heavy?.hljs;
  if (hljs && language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language }).value;
    } catch {
      // упадём в обычный escape ниже
    }
  }
  return escapeHtml(code);
}

const IMAGE_RE =
  /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+&quot;(.*?)&quot;)?\)/g;
const LINK_RE = /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g;

/** Значение для HTML-атрибута: без вложенных тегов и служебных плейсхолдеров. */
function attr(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\u0000(?:FORMULA|SLOT)\d+\u0000/g, "");
}

function emphasis(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function inline(rawText: string): string {
  // \u0000 служит границей плейсхолдеров, поэтому из пользовательского текста его убираем
  const text = rawText.replace(/\u0000/g, "");

  const formulaPlaceholders: string[] = [];
  const withPlaceholders = text.replace(/\$([^$\n]+)\$/g, (_, latex) => {
    const renderedHtml = renderFormula(latex, false);
    formulaPlaceholders.push(renderedHtml);
    return `\u0000FORMULA${formulaPlaceholders.length - 1}\u0000`;
  });

  // CommonMark backslash-escapes (\*, \~, \[, \] и т.д.) — символы, введённые буквально,
  // а не как разметка; tiptap-markdown сериализует их так, чтобы при повторном парсинге
  // они не стали настоящей разметкой. Прячем их в плейсхолдеры ДО прогона markdown-регэкспов,
  // иначе escapeHtml() потом оставит "\*" буквально, либо (если просто вырезать "\") символ
  // случайно станет реальной разметкой.
  const escapedCharPlaceholders: string[] = [];
  const withEscapesProtected = withPlaceholders.replace(
    /\\([!"#$%&'()*+,./:;<=>?@[\]^_`{|}~\\-])/g,
    (_, char) => {
      escapedCharPlaceholders.push(char);
      return `\u0000ESCAPED${escapedCharPlaceholders.length - 1}\u0000`;
    },
  );

  const escaped = escapeHtml(withEscapesProtected);
  const withUnescapedTags = escaped
    .replace(/&lt;u&gt;/g, "<u>")
    .replace(/&lt;\/u&gt;/g, "</u>")
    .replace(/&lt;sub&gt;/g, "<sub>")
    .replace(/&lt;\/sub&gt;/g, "</sub>")
    .replace(/&lt;sup&gt;/g, "<sup>")
    .replace(/&lt;\/sup&gt;/g, "</sup>");

  // Картинки и ссылки прячем в плейсхолдеры ДО остальной разметки, чтобы **, @mention
  // и {#id} не срабатывали внутри их атрибутов и не ломали HTML.
  const slots: string[] = [];
  const hold = (html: string) => {
    slots.push(html);
    return `\u0000SLOT${slots.length - 1}\u0000`;
  };

  const withImages = withUnescapedTags.replace(
    IMAGE_RE,
    (_m, alt: string, url: string, title?: string) =>
      hold(
        `<img src="${attr(url)}" alt="${attr(alt)}"${title ? ` title="${attr(title)}"` : ""} class="max-w-full rounded my-2" loading="lazy" referrerpolicy="no-referrer" />`,
      ),
  );
  const withLinks = withImages.replace(
    LINK_RE,
    (_m, label: string, url: string) =>
      hold(
        `<a href="${attr(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">${emphasis(label)}</a>`,
      ),
  );

  let result = emphasis(withLinks)
    .replace(/\{#([a-zA-Z0-9_-]+)\}/g, '<a id="$1" class="scroll-mt-20"></a>')
    .replace(
      /(?<![a-zA-Z0-9_.])@([a-zA-Z0-9_]+)/g,
      '<a href="/u/$1" class="text-blue-600 dark:text-blue-400 font-medium hover:underline">@$1</a>',
    );

  // Ссылка может содержать картинку (слот внутри слота), поэтому несколько проходов
  for (let pass = 0; pass < 3 && result.includes("\u0000SLOT"); pass++) {
    result = result.replace(
      /\u0000SLOT(\d+)\u0000/g,
      (_, idx) => slots[Number(idx)] ?? "",
    );
  }
  result = result.replace(
    /\u0000FORMULA(\d+)\u0000/g,
    (_, idx) => formulaPlaceholders[Number(idx)] ?? "",
  );
  result = result.replace(/\u0000ESCAPED(\d+)\u0000/g, (_, idx) =>
    escapeHtml(escapedCharPlaceholders[Number(idx)] ?? ""),
  );
  return result;
}

function isTableRow(line: string): boolean {
  return /^\|.+\|$/.test(line.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|(\s*:?-+:?\s*\|)+$/.test(line.trim());
}

function isHorizontalRule(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim());
}

function matchImageLine(
  line: string,
): { alt: string; url: string; title: string | null } | null {
  const match = line
    .trim()
    .match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+"([^"]*)")?\)$/);
  if (!match) return null;
  return { alt: match[1], url: match[2], title: match[3] ?? null };
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const HEADING_SIZE_CLASSES = ["text-2xl", "text-xl", "text-lg"];

function renderBlocks(raw: string): string {
  const lines = raw.split("\n");
  const html: string[] = [];
  let inList: "ul" | "ol" | null = null;

  const closeList = () => {
    if (inList) {
      html.push(inList === "ul" ? "</ul>" : "</ol>");
      inList = null;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const fenceMatch = line.match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      closeList();
      const lang = fenceMatch[1] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // пропустить закрывающую ```
      const highlighted = highlightCode(codeLines.join("\n"), lang);
      const langLabel = lang
        ? `<span class="absolute top-1.5 right-2 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">${escapeHtml(lang)}</span>`
        : "";
      html.push(
        `<div class="relative">${langLabel}<pre class="hljs bg-gray-100 dark:bg-gray-900 rounded p-3 my-2 overflow-x-auto text-xs"><code>${highlighted}</code></pre></div>`,
      );
      continue;
    }

    const spoilerStart = line.match(/^:::\s*spoiler\s*(.*)$/);
    if (spoilerStart) {
      closeList();
      const title = spoilerStart[1].trim() || "Спойлер";
      const innerLines: string[] = [];
      i++;
      let depth = 1;
      while (i < lines.length && depth > 0) {
        if (/^:::\s*spoiler\b/.test(lines[i])) depth++;
        else if (/^:::\s*$/.test(lines[i])) depth--;
        if (depth > 0) innerLines.push(lines[i]);
        i++;
      }
      const innerHtml = renderBlocks(innerLines.join("\n"));
      html.push(
        `<details class="my-1 border dark:border-gray-600 rounded overflow-hidden"><summary class="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 cursor-pointer text-sm font-medium dark:text-gray-100">${inline(title)}</summary><div class="p-2">${innerHtml}</div></details>`,
      );
      continue;
    }

    if (/^\$\$\s*$/.test(line)) {
      closeList();
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && !/^\$\$\s*$/.test(lines[i])) {
        mathLines.push(lines[i]);
        i++;
      }
      i++; // пропустить закрывающую $$
      const latex = mathLines.join("\n");
      html.push(
        `<div class="my-1 text-center overflow-x-auto">${renderFormula(latex, true)}</div>`,
      );
      continue;
    }

    if (isTableRow(line) && isTableSeparator(lines[i + 1] || "")) {
      closeList();
      const headerCells = splitTableRow(line);
      html.push(
        '<table class="border-collapse my-2 w-full text-sm"><thead><tr>',
      );
      for (const cell of headerCells) {
        html.push(
          `<th class="border dark:border-gray-600 px-2 py-1 text-left bg-gray-50 dark:bg-gray-700">${inline(cell)}</th>`,
        );
      }
      html.push("</tr></thead><tbody>");
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        const cells = splitTableRow(lines[i]);
        html.push("<tr>");
        for (const cell of cells)
          html.push(
            `<td class="border dark:border-gray-600 px-2 py-1">${inline(cell)}</td>`,
          );
        html.push("</tr>");
        i++;
      }
      html.push("</tbody></table>");
      continue;
    }

    if (isHorizontalRule(line)) {
      closeList();
      html.push('<hr class="border-gray-300 dark:border-gray-600 my-4" />');
      i++;
      continue;
    }

    const image = matchImageLine(line);
    if (image) {
      closeList();
      html.push(
        `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}"${image.title ? ` title="${escapeHtml(image.title)}"` : ""} class="max-w-full rounded my-2" loading="lazy" referrerpolicy="no-referrer" />`,
      );
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)/);
    const quote = line.match(/^>\s+(.*)/);
    const ulItem = line.match(/^-\s+(.*)/);
    const olItem = line.match(/^\d+\.\s+(.*)/);

    if (heading) {
      closeList();
      const level = heading[1].length;
      const sizeClass = HEADING_SIZE_CLASSES[level - 1] ?? "text-lg";
      html.push(
        `<h${level + 2} class="${sizeClass} font-bold mt-3 mb-1">${inline(heading[2])}</h${level + 2}>`,
      );
    } else if (quote) {
      closeList();
      html.push(
        `<blockquote class="border-l-2 pl-3 italic text-gray-600 dark:text-gray-400 my-1">${inline(quote[1])}</blockquote>`,
      );
    } else if (ulItem) {
      if (inList !== "ul") {
        closeList();
        html.push('<ul class="list-disc pl-5 my-1">');
        inList = "ul";
      }
      html.push(`<li>${inline(ulItem[1])}</li>`);
    } else if (olItem) {
      if (inList !== "ol") {
        closeList();
        html.push('<ol class="list-decimal pl-5 my-1">');
        inList = "ol";
      }
      html.push(`<li>${inline(olItem[1])}</li>`);
    } else if (line.trim() === "") {
      closeList();
      html.push("<br />");
    } else {
      closeList();
      html.push(`<p class="my-1">${inline(line)}</p>`);
    }

    i++;
  }
  closeList();

  return html.join("");
}

// ---------------------------------------------------------------------------
// Последний слой защиты: даже если рендерер где-то ошибётся, наружу уйдёт очищенный HTML.
// ---------------------------------------------------------------------------

DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
  // inline style нужен только KaTeX (размеры и отступы формул)
  if (data.attrName === "style" && !node.closest(".katex"))
    data.keepAttr = false;
});

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
    node.setAttribute("rel", "noopener noreferrer");
  }
});

const PURIFY_CONFIG: Config = {
  USE_PROFILES: { html: true, svg: true, mathMl: true }, // svg и MathML нужны KaTeX
  ADD_TAGS: ["semantics", "annotation"],
  ADD_ATTR: ["target", "loading", "referrerpolicy", "encoding"],
  FORBID_TAGS: [
    "style",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "iframe",
    "object",
    "embed",
    "link",
    "meta",
    "base",
  ],
  ALLOW_DATA_ATTR: false,
};

export function renderMarkdown(raw: string): string {
  const html = renderBlocks(raw);
  // Без DOM (например, тесты в окружении node) очистить нельзя: безопаснее показать текст, чем пропустить HTML
  if (!DOMPurify.isSupported) return escapeHtml(html);
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}
