import { useEffect, useMemo, useState } from "react";
import {
  loadMarkdownEngines,
  markdownEnginesReady,
  markdownNeedsEngines,
  renderMarkdown,
} from "@/shared/lib/markdown";

/**
 * HTML поста. Сразу отдаёт быстрый вариант; если в тексте есть формулы или код,
 * подгружает KaTeX и highlight.js и перерисовывает уже с ними.
 */
export function useMarkdownHtml(raw: string): string {
  const [, setTick] = useState(0);
  const needs = markdownNeedsEngines(raw);
  const ready = markdownEnginesReady();

  useEffect(() => {
    if (!needs || markdownEnginesReady()) return;
    let cancelled = false;
    loadMarkdownEngines()
      .then(() => {
        if (!cancelled) setTick((t) => t + 1);
      })
      .catch(() => {
        // нет сети: остаётся текст без подсветки и формул
      });
    return () => {
      cancelled = true;
    };
  }, [needs]);

  return useMemo(() => renderMarkdown(raw), [raw, ready]);
}