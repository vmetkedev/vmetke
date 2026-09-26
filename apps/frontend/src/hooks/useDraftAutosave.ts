import { useCallback, useEffect, useRef, useState } from "react";

interface DraftPayload {
  title: string;
  content: string;
  savedAt: number;
}

interface UseDraftAutosaveOptions {
  storageKey: string;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseDraftAutosaveResult {
  hasDraft: boolean;
  draftSavedAt: number | null;
  saveDraft: (title: string, content: string) => void;
  restoreDraft: () => { title: string; content: string } | null;
  discardDraft: () => void;
}

export function useDraftAutosave({
  storageKey,
  enabled = true,
  debounceMs = 1500,
}: UseDraftAutosaveOptions): UseDraftAutosaveResult {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const draftRef = useRef<DraftPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: DraftPayload = JSON.parse(raw);
        if (
          (parsed.content && parsed.content.trim().length > 0) ||
          (parsed.title && parsed.title.trim().length > 0)
        ) {
          draftRef.current = parsed;
          setHasDraft(true);
          setDraftSavedAt(parsed.savedAt);
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, enabled]);

  const saveDraft = useCallback(
    (title: string, content: string) => {
      if (!enabled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const titleTrimmed = title.trim();
        const contentTrimmed = content.trim();
        if (titleTrimmed.length === 0 && contentTrimmed.length === 0) {
          localStorage.removeItem(storageKey);
          return;
        }
        const payload: DraftPayload = { title, content, savedAt: Date.now() };
        try {
          localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {
          // квота localStorage переполнена — молча пропускаем автосохранение
        }
      }, debounceMs);
    },
    [storageKey, enabled, debounceMs]
  );

  const restoreDraft = useCallback((): { title: string; content: string } | null => {
    setHasDraft(false);
    if (!draftRef.current) return null;
    return { title: draftRef.current.title, content: draftRef.current.content };
  }, []);

  const discardDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    draftRef.current = null;
    setHasDraft(false);
    setDraftSavedAt(null);
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { hasDraft, draftSavedAt, saveDraft, restoreDraft, discardDraft };
}