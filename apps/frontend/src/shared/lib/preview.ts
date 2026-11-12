/**
 * Превью поста для ленты: обрезка markdown до `limit` символов так, чтобы
 * не ломать разметку.
 *
 * В лимит НЕ входят: ссылки на картинки ![alt](url), URL внутри [текст](url),
 * якоря {#name}. Неделимые элементы (формулы, `код`, @упоминания, блоки кода,
 * спойлеры) не режутся посередине. Незакрытые **жирный**, *курсив*, ~~зачёркнутый~~,
 * <u>, <sub>, <sup> закрываются.
 */

const TOKEN_RE = new RegExp(
  [
    /(?<esc>\\[\s\S])/,
    /(?<fence>^```[^\n]*(?:\n[\s\S]*?)?(?:\n```[ \t]*(?=\n|(?![\s\S]))|(?![\s\S])))/,
    /(?<spoiler>^:::[ \t]*spoiler[^\n]*\n[\s\S]*?\n:::[ \t]*(?=\n|(?![\s\S])))/,
    /(?<bformula>\$\$[\s\S]*?\$\$)/,
    /(?<image>!\[[^\]]*\]\([^)]*\))/,
    /(?<link>\[(?<linktext>[^\]]*)\]\([^)]*\))/,
    /(?<iformula>\$[^$\n]+\$)/,
    /(?<code>`[^`\n]+`)/,
    /(?<anchor>\{#[^}\n]*\})/,
    /(?<mention>@[\w-]+)/,
  ]
    .map((r) => r.source)
    .join("|"),
  "gm",
);

const DANGLING_RE = /(?:\*{1,3}|~~|<(?:u|sub|sup)>)$/;

function clipFence(tok: string, rest: number): string {
  const lines = tok.split("\n");
  const kept = [lines[0]];
  let used = 0;
  for (const line of lines.slice(1)) {
    if (line.trim() === "```") break;
    if (used + line.length > rest) break;
    kept.push(line);
    used += line.length + 1;
  }
  kept.push("```");
  return kept.join("\n");
}

function closers(plain: string): string {
  const s = plain.replace(/^\s*[*+-]\s/gm, "");
  let tail = "";

  for (const tag of ["u", "sub", "sup"]) {
    const opened = (s.match(new RegExp(`<${tag}>`, "g")) ?? []).length;
    const closed = (s.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
    if (opened > closed) tail += `</${tag}>`;
  }

  if ((s.match(/~~/g) ?? []).length % 2) tail += "~~";

  const bold = (s.match(/\*\*/g) ?? []).length;
  const italic = (s.replace(/\*\*/g, "").match(/\*/g) ?? []).length;
  if (italic % 2) tail += "*";
  if (bold % 2) tail += "**";

  return tail;
}

export function truncateMarkdown(
  text: string,
  limit = 500,
): { text: string; truncated: boolean } {
  let out = "";
  let plain = ""; // только обычный текст — для баланса маркеров
  let count = 0;
  let last = 0;
  let endsWithBlock = false;
  let truncated = false;

  const addPlain = (chunk: string): boolean => {
    if (!chunk) return true;
    const rest = limit - count;
    if (chunk.length <= rest) {
      out += chunk;
      plain += chunk;
      count += chunk.length;
      endsWithBlock = false;
      return true;
    }
    let cut = chunk.slice(0, Math.max(rest, 0));
    // не рубим слово, если пробел рядом
    const sp = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
    if (sp > 0 && cut.length - sp <= 40) cut = cut.slice(0, sp);
    if (cut) endsWithBlock = false;
    out += cut;
    plain += cut;
    count += cut.length;
    return false;
  };

  const push = (s: string, weight: number, block = false) => {
    out += s;
    count += weight;
    endsWithBlock = block;
  };

  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    if (!addPlain(text.slice(last, idx))) {
      truncated = true;
      break;
    }
    const g: Record<string, string | undefined> = m.groups ?? {};
    const tok = m[0];
    last = idx + tok.length;
    const rest = limit - count;

    // нулевой вес
    if (g.image !== undefined || g.anchor !== undefined) {
      push(tok, 0);
      continue;
    }

    if (g.link !== undefined) {
      const label = g.linktext ?? "";
      if (label.length <= rest) {
        push(tok, label.length);
        continue;
      }
      if (rest > 0) {
        // обрезаем подпись, URL оставляем целиком
        push("[" + label.slice(0, rest) + tok.slice(1 + label.length), rest);
      }
      truncated = true;
      break;
    }

    if (g.fence !== undefined) {
      if (tok.length <= rest) {
        push(tok, tok.length, true);
        continue;
      }
      if (rest > 0) push(clipFence(tok, rest), rest, true);
      truncated = true;
      break;
    }

    const weight = g.esc !== undefined ? 1 : tok.length;
    if (weight <= rest) {
      push(tok, weight, g.spoiler !== undefined || g.bformula !== undefined);
      continue;
    }
    truncated = true;
    break;
  }

  if (!truncated && !addPlain(text.slice(last))) truncated = true;
  if (!truncated) return { text, truncated: false };

  let body = out.trimEnd();
  let p = plain.trimEnd();
  if (DANGLING_RE.test(body) && DANGLING_RE.test(p)) {
    body = body.replace(DANGLING_RE, "").trimEnd();
    p = p.replace(DANGLING_RE, "").trimEnd();
  }

  const ellipsis = body && endsWithBlock ? "\n\n…" : "…";
  return { text: body + ellipsis + closers(p), truncated: true };
}