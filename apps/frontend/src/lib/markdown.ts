function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(rawText: string): string {
  const escaped = escapeHtml(rawText);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(
      /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>'
    );
}

export function renderMarkdown(raw: string): string {
  const lines = raw.split("\n");
  const html: string[] = [];
  let inList: "ul" | "ol" | null = null;

  const closeList = () => {
    if (inList) {
      html.push(inList === "ul" ? "</ul>" : "</ol>");
      inList = null;
    }
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.*)/);
    const quote = line.match(/^>\s+(.*)/);
    const ulItem = line.match(/^-\s+(.*)/);
    const olItem = line.match(/^\d+\.\s+(.*)/);

    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level + 2} class="font-semibold mt-2 mb-1">${inline(heading[2])}</h${level + 2}>`);
    } else if (quote) {
      closeList();
      html.push(`<blockquote class="border-l-2 pl-3 italic text-gray-600 dark:text-gray-400 my-1">${inline(quote[1])}</blockquote>`);
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
  }
  closeList();

  return html.join("");
}