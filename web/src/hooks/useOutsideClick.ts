import { useEffect, useRef, type RefObject } from "react";

export function useOutsideClick<T extends HTMLElement>(
  handler: () => void
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handlerRef.current();
      }
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, []);

  return ref;
}
