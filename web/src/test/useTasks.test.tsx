import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockGetFullList = vi.fn();
const mockGetList = vi.fn();
const mockGetOne = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockCollection = vi.fn((_name: string) => ({
  getFullList: mockGetFullList,
  getList: mockGetList,
  getOne: mockGetOne,
  create: mockCreate,
  update: mockUpdate,
  delete: mockDelete,
}));

vi.mock("../api/client", () => ({
    pb: {
        collection: mockCollection,
        authStore: { record: { id: "user1" }, isValid: true },
      },
}));


const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mockTasks = [
  { id: "1", name: "Task A", status: "in_progress", weight: 50, category: "normal" },
  { id: "2", name: "Task B", status: "completed", weight: 80, category: "important" },
];

describe("useTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("fetches tasks with useTasks", async () => {
    mockGetFullList.mockResolvedValue(mockTasks);
    const { useTasks } = await import("../hooks/useTasks");
    const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTasks);
    expect(mockGetFullList).toHaveBeenCalled();
  });

  it("fetches single task with useTask", async () => {
    mockGetOne.mockResolvedValue(mockTasks[0]);
    const { useTask } = await import("../hooks/useTasks");
    const { result } = renderHook(() => useTask("1"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTasks[0]);
  });

  it("useCreateTask calls pb create", async () => {
    mockCreate.mockResolvedValue(mockTasks[0]);
    const { useCreateTask } = await import("../hooks/useTasks");
    const { result } = renderHook(() => useCreateTask(), { wrapper: Wrapper });
    await result.current.mutateAsync({ name: "New Task" });
    expect(mockCreate).toHaveBeenCalledWith({ name: "New Task" });
  });

  it("useUpdateTask calls pb update", async () => {
    mockUpdate.mockResolvedValue({ ...mockTasks[0], name: "Updated" });
    const { useUpdateTask } = await import("../hooks/useTasks");
    const { result } = renderHook(() => useUpdateTask(), { wrapper: Wrapper });
    await result.current.mutateAsync({ id: "1", data: { name: "Updated" } as any });
    expect(mockUpdate).toHaveBeenCalledWith("1", { name: "Updated" });
  });

  it("useSoftDeleteTask calls pb update with is_deleted=true", async () => {
    mockUpdate.mockResolvedValue({ id: "1", is_deleted: true });
    const { useSoftDeleteTask } = await import("../hooks/useTasks");
    const { result } = renderHook(() => useSoftDeleteTask(), { wrapper: Wrapper });
    await result.current.mutateAsync("1");
    expect(mockUpdate).toHaveBeenCalledWith("1", { is_deleted: true });
  });
});
