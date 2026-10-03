import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "../hooks/useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 500));
    expect(result.current).toBe("hello");
  });

  it("does not update before delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "old", delay: 500 } }
    );
    rerender({ value: "new", delay: 500 });
    expect(result.current).toBe("old");
  });

  it("updates after delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "old", delay: 500 } }
    );
    rerender({ value: "new", delay: 500 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe("new");
  });

  it("resets timer on rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 500 } }
    );
    rerender({ value: "b", delay: 500 });
    act(() => { vi.advanceTimersByTime(300); });
    rerender({ value: "c", delay: 500 });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe("a");
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("c");
  });

  it("works with numbers", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 0 } }
    );
    rerender({ value: 42 });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe(42);
  });

  it("works with zero delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 0 } }
    );
    rerender({ value: "b", delay: 0 });
    act(() => { vi.advanceTimersByTime(0); });
    expect(result.current).toBe("b");
  });
});
