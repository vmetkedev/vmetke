import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coalesce } from "./coalesce";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("coalesce", () => {
  it("склеивает серию вызовов в один", () => {
    const fn = vi.fn();
    const run = coalesce(fn, 100);
    run();
    run();
    run();
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("после срабатывания принимает новую серию", () => {
    const fn = vi.fn();
    const run = coalesce(fn, 100);
    run();
    vi.advanceTimersByTime(100);
    run();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("cancel отменяет ожидающий вызов", () => {
    const fn = vi.fn();
    const run = coalesce(fn, 100);
    run();
    run.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });
});