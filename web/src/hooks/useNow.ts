import { useEffect, useState } from "react";

/**
 * Returns the current timestamp (ms), refreshed on an interval.
 * Use instead of calling Date.now() during render/useMemo — calling it
 * directly is impure and trips the react-hooks purity checks.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
