import { useCallback, useEffect, useMemo, useRef } from "react";

interface Options<T> {
  data: { pages: T[][] } | undefined;
  isPending: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  resetKey?: unknown;
}

export function useInfiniteChatScroll<T>({
  data,
  isPending,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  resetKey,
}: Options<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  // Each page is newest-first (sort -created); display oldest -> newest
  const items = useMemo(
    () => (data?.pages ?? []).slice().reverse().flatMap((p) => [...p].reverse()),
    [data]
  );

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    stickBottomRef.current = true;
  }, [resetKey]);

  useEffect(() => {
    if (!stickBottomRef.current) return;
    scrollToBottom();
  }, [items.length, scrollToBottom]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !loadingOlderRef.current || isFetchingNextPage) return;
    loadingOlderRef.current = false;
    el.scrollTop = el.scrollHeight - prevScrollHeightRef.current + el.scrollTop;
  }, [isFetchingNextPage, items.length]);

  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickBottomRef.current = atBottom;
    if (el.scrollTop < 60 && hasNextPage && !isFetchingNextPage && !isPending) {
      loadingOlderRef.current = true;
      prevScrollHeightRef.current = el.scrollHeight;
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isPending]);

  return { listRef, items, onScroll, scrollToBottom, isFetchingNextPage, hasNextPage };
}
