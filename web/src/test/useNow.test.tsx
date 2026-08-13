import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNow } from "../hooks/useNow";

const T0 = new Date("2026-08-10T08:00:00Z").getTime();

describe("useNow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current timestamp at mount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { result } = renderHook(() => useNow());
    expect(result.current).toBe(T0);
  });

  it("does not tick before the interval elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { result } = renderHook(() => useNow());
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe(T0);
  });

  it("ticks after the default 60s interval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { result } = renderHook(() => useNow());
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(T0 + 60_000);
  });

  it("honors a custom interval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { result } = renderHook(() => useNow(5000));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBe(T0 + 5_000);
  });

  it("clears the interval on unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { unmount } = renderHook(() => useNow());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
