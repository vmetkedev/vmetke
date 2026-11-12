import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDraftAutosave } from "./useDraftAutosave";

const STORAGE_KEY = "vmetke:draft:test";

describe("useDraftAutosave", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it("не находит черновик, если localStorage пуст", () => {
    const { result } = renderHook(() =>
      useDraftAutosave({ storageKey: STORAGE_KEY })
    );
    expect(result.current.hasDraft).toBe(false);
    expect(result.current.draftSavedAt).toBeNull();
  });

  it("находит существующий черновик при монтировании", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ title: "Заголовок", content: "Текст", savedAt: 12345 })
    );
    const { result } = renderHook(() =>
      useDraftAutosave({ storageKey: STORAGE_KEY })
    );
    expect(result.current.hasDraft).toBe(true);
    expect(result.current.draftSavedAt).toBe(12345);
  });

  it("игнорирует битый JSON в localStorage и очищает ключ", () => {
    localStorage.setItem(STORAGE_KEY, "{не json");
    const { result } = renderHook(() =>
      useDraftAutosave({ storageKey: STORAGE_KEY })
    );
    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("не считает черновиком запись с пустыми title и content", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ title: "  ", content: "  ", savedAt: 1 })
    );
    const { result } = renderHook(() =>
      useDraftAutosave({ storageKey: STORAGE_KEY })
    );
    expect(result.current.hasDraft).toBe(false);
  });

  it("сохраняет в localStorage через debounce после saveDraft", () => {
    const { result } = renderHook(() =>
      useDraftAutosave({ storageKey: STORAGE_KEY, debounceMs: 1500 })
    );

    act(() => {
      result.current.saveDraft("Заголовок", "Текст поста");
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.title).toBe("Заголовок");
    expect(saved.content).toBe("Текст поста");
    expect(typeof saved.savedAt).toBe("number");
  });

  it("схлопывает частые вызовы saveDraft в одно сохранение (debounce)", () => {
    const { result } = renderHook(() =>
      useDraftAutosave({ storageKey: STORAGE_KEY, debounceMs: 1000 })
    );

    act(() => {
      result.current.saveDraft("A", "1");
      vi.advanceTimersByTime(500);
      result.current.saveDraft("AB", "12");
      vi.advanceTimersByTime(500);
      result.current.saveDraft("ABC", "123");
      vi.advanceTimersByTime(1000);
    });

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.title).toBe("ABC");
    expect(saved.content).toBe("123");
  });

  it("не пишет в localStorage при пустых title и content", () => {
    const { result } = renderHook(() =>
      useDraftAutosave({ storageKey: STORAGE_KEY, debounceMs: 500 })
    );
    act(() => {
      result.current.saveDraft("  ", "  ");
      vi.advanceTimersByTime(500);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("restoreDraft возвращает данные черновика и сбрасывает hasDraft", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ title: "T", content: "C", savedAt: 1 })
    );
    const { result } = renderHook(() =>
      useDraftAutosave({ storageKey: STORAGE_KEY })
    );

    let restored: { title: string; content: string } | null = null;
    act(() => {
      restored = result.current.restoreDraft();
    });

    expect(restored).toEqual({ title: "T", content: "C" });
    expect(result.current.hasDraft).toBe(false);
  });

  it("restoreDraft возвращает null, если черновика не было", () => {
    const { result } = renderHook(() =>
      useDraftAutosave({ storageKey: STORAGE_KEY })
    );
    let restored: unknown = "не тронуто";
    act(() => {
      restored = result.current.restoreDraft();
    });
    expect(restored).toBeNull();
  });

  it("discardDraft очищает localStorage и состояние", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ title: "T", content: "C", savedAt: 1 })
    );
    const { result } = renderHook(() =>
      useDraftAutosave({ storageKey: STORAGE_KEY })
    );
    act(() => {
      result.current.discardDraft();
    });
    expect(result.current.hasDraft).toBe(false);
    expect(result.current.draftSavedAt).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("не сохраняет и не находит черновик при enabled: false", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ title: "T", content: "C", savedAt: 1 })
    );
    const { result } = renderHook(() =>
      useDraftAutosave({ storageKey: STORAGE_KEY, enabled: false })
    );
    expect(result.current.hasDraft).toBe(false);

    act(() => {
      result.current.saveDraft("X", "Y");
      vi.advanceTimersByTime(5000);
    });
    // старая запись в localStorage не тронута, новая не создана
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.title).toBe("T");
  });
});