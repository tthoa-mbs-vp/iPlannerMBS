import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockGetFullList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockCollection = vi.fn((_name: string) => ({
  getFullList: mockGetFullList,
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

const mockComments = [
  { id: "c1", task_id: "t1", user_id: "u1", content: "Hello", files: [], created: new Date().toISOString(), updated: new Date().toISOString() },
  { id: "c2", task_id: "t1", user_id: "u2", content: "World", files: [], created: new Date().toISOString(), updated: new Date().toISOString() },
];

describe("useComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("fetches comments by taskId", async () => {
    mockGetFullList.mockResolvedValue(mockComments);
    const { useComments } = await import("../hooks/useComments");
    const { result } = renderHook(() => useComments("t1"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockComments);
    expect(mockGetFullList).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ filter: 'task_id="t1"' })
    );
  });

  it("useCreateComment creates with data and files", async () => {
    mockCreate.mockResolvedValue(mockComments[0]);
    const { useCreateComment } = await import("../hooks/useComments");
    const { result } = renderHook(() => useCreateComment(), { wrapper: Wrapper });
    await result.current.mutateAsync({ data: { task_id: "t1", content: "Hi" }, files: [] });
    expect(mockCreate).toHaveBeenCalledWith({ task_id: "t1", content: "Hi", files: undefined });
  });

  it("useCreateComment passes files when present", async () => {
    mockCreate.mockResolvedValue(mockComments[0]);
    const file = new File(["test"], "test.png", { type: "image/png" });
    const { useCreateComment } = await import("../hooks/useComments");
    const { result } = renderHook(() => useCreateComment(), { wrapper: Wrapper });
    await result.current.mutateAsync({ data: { task_id: "t1", content: "Hi" }, files: [file] });
    expect(mockCreate).toHaveBeenCalledWith({ task_id: "t1", content: "Hi", files: [file] });
  });

  it("useUpdateComment updates comment", async () => {
    mockUpdate.mockResolvedValue(mockComments[0]);
    const { useUpdateComment } = await import("../hooks/useComments");
    const { result } = renderHook(() => useUpdateComment(), { wrapper: Wrapper });
    await result.current.mutateAsync({ id: "c1", data: { content: "Updated" } });
    expect(mockUpdate).toHaveBeenCalledWith("c1", { content: "Updated", files: undefined });
  });

  it("useDeleteComment deletes comment", async () => {
    mockDelete.mockResolvedValue(true);
    const { useDeleteComment } = await import("../hooks/useComments");
    const { result } = renderHook(() => useDeleteComment(), { wrapper: Wrapper });
    await result.current.mutateAsync({ id: "c1" });
    expect(mockDelete).toHaveBeenCalledWith("c1");
  });
});
