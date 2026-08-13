import { useState, useEffect, useRef } from "react";

export function usePersistedState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(valueRef.current));
      } catch {
        // quota exceeded, ignore
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [key, value]);

  return [value, setValue];
}
