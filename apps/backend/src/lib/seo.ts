export interface SeoPost {
  id: string;
  title: string | null;
  content: string;
  tags: unknown;
  createdAt: Date;
  author: { username: string; displayName?: string | null };
}

export interface HeadParts {
  title: string;
  tags: string;
}

const SITE_NAME = "Vmetke.ru";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Markdown (включая кастомный синтаксис vmetke) -> обычный текст для description. */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, "\n")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/(?<!\\)\$[^$\n]+\$/g, " ")
    .replace(/^:::.*$/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\{#[^}\s]+\}/g, " ")
    .replace(/<\/?(u|sub|sup)>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>+\s?/gm, "")
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "")
    .replace(/^[\s:|-]+$/gm, " ")
    .replace(/\|/g, " ")
    .replace(/\\([!-\/:-@\[-`{-~])/g, "$1")
    .replace(/(\*\*|__|~~|`|\*)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s.,;:!?-]+$/, "") + "…";
}

/** Первая картинка поста: только абсолютные http(s)-ссылки и /uploads/. */
export function firstImageUrl(markdown: string, siteUrl: string): string | null {
  const match = markdown.match(/!\[[^\]]*\]\(\s*([^\s)]+)/);
  if (!match) return null;
  const url = match[1].replace(/^</, "").replace(/>$/, "");
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/uploads/")) return siteUrl + url;
  return null;
}

const metaName = (key: string, content: string) =>
  `<meta name="${key}" content="${escapeHtml(content)}">`;
const metaProp = (key: string, content: string) =>
  `<meta property="${key}" content="${escapeHtml(content)}">`;

export function buildPostHead(post: SeoPost, siteUrl: string): HeadParts {
  const url = `${siteUrl}/post/${post.id}`;
  const authorName = post.author.displayName || post.author.username;
  const plain = markdownToPlainText(post.content);
  const description = truncate(plain, 200) || `Пост автора ${authorName} на ${SITE_NAME}`;
  // у поста может не быть заголовка: берём начало текста
  const title = post.title?.trim() || truncate(plain, 70) || `Пост автора ${authorName}`;
  const image = firstImageUrl(post.content, siteUrl);
  const ogImage = image ?? `${siteUrl}/icon-512.png`;
  const tags = Array.isArray(post.tags)
    ? post.tags.filter((t): t is string => typeof t === "string")
    : [];
  const published = post.createdAt.toISOString();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: truncate(title, 110),
    description,
    datePublished: published,
    author: { "@type": "Person", name: authorName },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${siteUrl}/icon-512.png` },
    },
    mainEntityOfPage: url,
    ...(image ? { image: [image] } : {}),
    ...(tags.length ? { keywords: tags.join(", ") } : {}),
  };

  const lines = [
    metaName("description", description),
    metaName("author", authorName),
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    metaProp("og:site_name", SITE_NAME),
    metaProp("og:locale", "ru_RU"),
    metaProp("og:type", "article"),
    metaProp("og:url", url),
    metaProp("og:title", title),
    metaProp("og:description", description),
    metaProp("og:image", ogImage),
    metaProp("article:published_time", published),
    metaProp("article:author", authorName),
    ...tags.map((t) => metaProp("article:tag", t)),
    metaName("twitter:card", image ? "summary_large_image" : "summary"),
    metaName("twitter:title", title),
    metaName("twitter:description", description),
    metaName("twitter:image", ogImage),
    // "<" экранируем, чтобы заголовок с "</script>" не закрыл тег
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`,
  ];

  return { title: `${title} | ${SITE_NAME}`, tags: lines.join("\n") };
}

export function buildNotFoundHead(): HeadParts {
  return {
    title: `Пост не найден | ${SITE_NAME}`,
    tags: metaName("robots", "noindex, nofollow"),
  };
}

/** Подставляет title и мета-теги в собранный index.html. */
export function injectHead(template: string, head: HeadParts): string {
  // Функции-замены (а не строки), иначе "$&" и "$1" из текста поста сработают как шаблоны replace
  return template
    .replace(/<meta\b[^>]*\bdata-seo-default\b[^>]*>\s*/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(head.title)}</title>`)
    .replace(/<\/head>/i, () => `${head.tags}\n</head>`);
}