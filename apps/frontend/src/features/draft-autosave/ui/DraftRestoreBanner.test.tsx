import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DraftRestoreBanner } from "./DraftRestoreBanner";

describe("DraftRestoreBanner", () => {
  it("показывает текст с датой сохранения", () => {
    const savedAt = new Date("2026-09-26T07:15:00").getTime();
    render(
      <DraftRestoreBanner savedAt={savedAt} onRestore={vi.fn()} onDiscard={vi.fn()} />
    );
    expect(
      screen.getByText(/У вас есть резервное сохранение материала от/)
    ).toBeInTheDocument();
  });

  it("вызывает onRestore при клике на 'Восстановить'", () => {
    const onRestore = vi.fn();
    render(
      <DraftRestoreBanner savedAt={Date.now()} onRestore={onRestore} onDiscard={vi.fn()} />
    );
    fireEvent.click(screen.getByText("Восстановить"));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("вызывает onDiscard при клике на кнопку-крестик", () => {
    const onDiscard = vi.fn();
    render(
      <DraftRestoreBanner savedAt={Date.now()} onRestore={vi.fn()} onDiscard={onDiscard} />
    );
    fireEvent.click(screen.getByLabelText("Удалить черновик"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("форматирует сегодняшнюю дату как 'сегодня в HH:MM'", () => {
    render(
      <DraftRestoreBanner savedAt={Date.now()} onRestore={vi.fn()} onDiscard={vi.fn()} />
    );
    expect(screen.getByText(/сегодня в \d{2}:\d{2}/)).toBeInTheDocument();
  });
});