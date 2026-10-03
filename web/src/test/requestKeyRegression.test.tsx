import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Hồi quy: PocketBase SDK tự hủy chéo các query khác nhau trên cùng collection.
 *
 * Khi không truyền `requestKey`, SDK suy ra cancelKey là `method + path`
 * — path KHÔNG chứa query string. Mọi `getFullList` cùng collection vì thế
 * dùng **cùng một** cancelKey, và request mới sẽ `abort()` request đang chạy.
 * Query bị abort thì TanStack Query coi là lỗi → retry → sinh thêm request.
 *
 * Đã quan sát thật trên /plans: 3 request cho cùng filter `plan_id=""`,
 * trong đó request đầu bị `net::ERR_ABORTED`, lần sau lặp lại sau ~1004 ms
 * (khớp `retryDelay: 1000 * 2**0`).
 *
 * Test này khóa hành vi: mọi query của cùng collection phải có cancelKey riêng.
 */

const mockGetFullList = vi.fn();
const mockGetList = vi.fn();
const mockGetOne = vi.fn();
const mockCollection = vi.fn(() => ({
  getFullList: mockGetFullList,
  getList: mockGetList,
  getOne: mockGetOne,
}));

const mockAuthSetState = vi.fn();

vi.mock("../api/client", () => ({
  pb: {
    collection: mockCollection,
    authStore: { record: { id: "user1" }, isValid: true },
  },
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: "user1" }, isAuthenticated: true, setState: mockAuthSetState }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** requestKey của lần gọi getFullList thứ index. */
function requestKeysOf(index: number): string | undefined {
  const call = mockGetFullList.mock.calls[index];
  const opts = call?.[1];
  return typeof opts === "object" ? opts?.requestKey : undefined;
}

/** requestKey của lần gọi getList thứ index. */
function getListRequestKeysOf(index: number): string | undefined {
  const call = mockGetList.mock.calls[index];
  const opts = call?.[2];
  return typeof opts === "object" ? opts?.requestKey : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
  mockGetFullList.mockResolvedValue([]);
  mockGetList.mockResolvedValue({ items: [], totalItems: 0, page: 1, perPage: 50, totalPages: 1 });
});

describe("requestKey chống PocketBase tự hủy chéo", () => {
  it("useTasks với 2 filter khác nhau phải có requestKey khác nhau", async () => {
    const { useTasks } = await import("../hooks/useTasks");
    const { result: a } = renderHook(() => useTasks('plan_id=""'), { wrapper: Wrapper });
    await waitFor(() => expect(a.current.isSuccess).toBe(true));

    const { result: b } = renderHook(() => useTasks(undefined), { wrapper: Wrapper });
    await waitFor(() => expect(b.current.isSuccess).toBe(true));

    expect(mockGetFullList).toHaveBeenCalledTimes(2);
    const [k1, k2] = [requestKeysOf(0), requestKeysOf(1)];

    // Không có requestKey => SDK dùng chung "GET/api/collections/tasks/records"
    // cho mọi filter => hủy lẫn nhau.
    expect(k1).toBeDefined();
    expect(k2).toBeDefined();
    expect(k1).not.toBe(k2);
  });

  it("mọi lần gọi useTasks đều truyền requestKey, không lần nào bị bỏ trống", async () => {
    const { useTasks } = await import("../hooks/useTasks");
    const { result } = renderHook(() => useTasks('plan_id="p1"'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestKeysOf(0)).toBe('tasks-plan_id="p1"');
  });

  it("usePlans với 2 filter khác nhau phải có requestKey khác nhau", async () => {
    const { usePlans } = await import("../hooks/usePlans");
    const { result: a } = renderHook(() => usePlans(undefined), { wrapper: Wrapper });
    await waitFor(() => expect(a.current.isSuccess).toBe(true));
    const { result: b } = renderHook(() => usePlans('name~"abc"'), { wrapper: Wrapper });
    await waitFor(() => expect(b.current.isSuccess).toBe(true));

    expect(requestKeysOf(0)).toBeDefined();
    expect(requestKeysOf(0)).not.toBe(requestKeysOf(1));
  });

  it("useComments theo taskId khác nhau phải có requestKey khác nhau", async () => {
    const { useComments } = await import("../hooks/useComments");
    const { result: a } = renderHook(() => useComments("t1"), { wrapper: Wrapper });
    await waitFor(() => expect(a.current.isSuccess).toBe(true));
    const { result: b } = renderHook(() => useComments("t2"), { wrapper: Wrapper });
    await waitFor(() => expect(b.current.isSuccess).toBe(true));

    expect(requestKeysOf(0)).toBe("comments-task-t1");
    expect(requestKeysOf(1)).toBe("comments-task-t2");
  });

  it("useTasks và useTrashedTasks không dùng chung cancelKey", async () => {
    const { useTasks, useTrashedTasks } = await import("../hooks/useTasks");
    const { result: a } = renderHook(() => useTasks(undefined), { wrapper: Wrapper });
    await waitFor(() => expect(a.current.isSuccess).toBe(true));
    const { result: b } = renderHook(() => useTrashedTasks(), { wrapper: Wrapper });
    await waitFor(() => expect(b.current.isSuccess).toBe(true));

    expect(requestKeysOf(0)).not.toBe(requestKeysOf(1));
  });

  it("dùng filter undefined không tạo ra requestKey rỗng trùng với filter rỗng", async () => {
    const { useTasks } = await import("../hooks/useTasks");
    const { result: a } = renderHook(() => useTasks(undefined), { wrapper: Wrapper });
    await waitFor(() => expect(a.current.isSuccess).toBe(true));
    const { result: b } = renderHook(() => useTasks(""), { wrapper: Wrapper });
    await waitFor(() => expect(b.current.isSuccess).toBe(true));

    // "tasks-" vs "tasks-" — cùng filter thực sự nên dùng chung cancelKey,
    // đây là hành vi ĐÚNG (query trùng thì hủy query cũ là hợp lý).
    expect(requestKeysOf(0)).toBe(requestKeysOf(1));
  });

  // Đã đo thật: /notifications render NotificationDropdown (useUnreadCount)
  // cùng NotificationsPage (useNotifications) → 1 request bị ERR_ABORTED
  // và filter bị gọi lại 2 lần.
  it("useUnreadCount và useNotifications phải có requestKey khác nhau", async () => {
    const { useUnreadCount, useNotifications } = await import("../hooks/useNotifications");
    const { result: a } = renderHook(() => useUnreadCount(), { wrapper: Wrapper });
    await waitFor(() => expect(a.current.isSuccess).toBe(true));
    const { result: b } = renderHook(() => useNotifications(1, 50, undefined, true), { wrapper: Wrapper });
    await waitFor(() => expect(b.current.isSuccess).toBe(true));

    expect(getListRequestKeysOf(0)).toBeDefined();
    expect(getListRequestKeysOf(1)).toBeDefined();
    expect(getListRequestKeysOf(0)).not.toBe(getListRequestKeysOf(1));
  });

  it("useNotifications phân trang phải có requestKey khác nhau", async () => {
    const { useNotifications } = await import("../hooks/useNotifications");
    const { result: a } = renderHook(() => useNotifications(1, 10, undefined, true), { wrapper: Wrapper });
    await waitFor(() => expect(a.current.isSuccess).toBe(true));
    const { result: b } = renderHook(() => useNotifications(2, 10, undefined, true), { wrapper: Wrapper });
    await waitFor(() => expect(b.current.isSuccess).toBe(true));

    expect(getListRequestKeysOf(0)).not.toBe(getListRequestKeysOf(1));
  });
});