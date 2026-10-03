import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistedState } from "../hooks/usePersistedState";

describe("usePersistedState", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns default value when localStorage is empty", () => {
    const { result } = renderHook(() => usePersistedState("test-key", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("reads from localStorage on init", () => {
    localStorage.setItem("test-key", JSON.stringify("stored-value"));
    const { result } = renderHook(() => usePersistedState("test-key", "default"));
    expect(result.current[0]).toBe("stored-value");
  });

  it("reads number from localStorage", () => {
    localStorage.setItem("test-num", JSON.stringify(42));
    const { result } = renderHook(() => usePersistedState("test-num", 0));
    expect(result.current[0]).toBe(42);
  });

  it("reads boolean from localStorage", () => {
    localStorage.setItem("test-bool", JSON.stringify(true));
    const { result } = renderHook(() => usePersistedState("test-bool", false));
    expect(result.current[0]).toBe(true);
  });

  it("updates value via setter", () => {
    const { result } = renderHook(() => usePersistedState("test-key", "initial"));
    act(() => {
      result.current[1]("updated");
    });
    expect(result.current[0]).toBe("updated");
  });

  it("persists to localStorage after update (with delay)", () => {
    const { result } = renderHook(() => usePersistedState("test-key", "initial"));
    act(() => {
      result.current[1]("updated");
    });
    // Not yet persisted (250ms debounce)
    expect(localStorage.getItem("test-key")).toBeNull();
    // After 250ms
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(localStorage.getItem("test-key")).toBe(JSON.stringify("updated"));
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("test-key", "not-valid-json{{{");
    const { result } = renderHook(() => usePersistedState("test-key", "fallback"));
    expect(result.current[0]).toBe("fallback");
  });

  it("supports functional updater", () => {
    const { result } = renderHook(() => usePersistedState("test-key", 10));
    act(() => {
      result.current[1]((prev) => prev + 5);
    });
    expect(result.current[0]).toBe(15);
  });

  it("returns different values for different keys", () => {
    localStorage.setItem("key-a", JSON.stringify("A"));
    localStorage.setItem("key-b", JSON.stringify("B"));
    const { result: resultA } = renderHook(() => usePersistedState("key-a", ""));
    const { result: resultB } = renderHook(() => usePersistedState("key-b", ""));
    expect(resultA.current[0]).toBe("A");
    expect(resultB.current[0]).toBe("B");
  });
});
