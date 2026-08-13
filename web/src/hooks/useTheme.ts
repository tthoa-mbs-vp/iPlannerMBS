import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

const LS_KEY = "theme_mode";

function getSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

function applyTheme(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && getSystemDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(LS_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, mode);
    applyTheme(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [mode]);

  const cycle = useCallback(() => {
    setMode((prev) => (prev === "system" ? "light" : prev === "light" ? "dark" : "system"));
  }, []);

  return { mode, setMode, cycle };
}
