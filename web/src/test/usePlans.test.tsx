import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockGetFullList = vi.fn();
const mockGetOne = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockCollection = vi.fn((_name: string) => ({
  getFullList: mockGetFullList,
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

const mockPlans = [
  { id: "p1", name: "Plan 1", status: "in_progress", progress: 50, is_deleted: false, created: new Date().toISOString(), updated: new Date().toISOString() },
  { id: "p2", name: "Plan 2", status: "completed", progress: 100, is_deleted: false, created: new Date().toISOString(), updated: new Date().toISOString() },
];

describe("usePlans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("fetches plans list", async () => {
    mockGetFullList.mockResolvedValue(mockPlans);
    const { usePlans } = await import("../hooks/usePlans");
    const { result } = renderHook(() => usePlans(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPlans);
  });

  it("fetches single plan by id", async () => {
    mockGetOne.mockResolvedValue(mockPlans[0]);
    const { usePlan } = await import("../hooks/usePlans");
    const { result } = renderHook(() => usePlan("p1"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPlans[0]);
  });

  it("useCreatePlan creates a plan", async () => {
    mockCreate.mockResolvedValue(mockPlans[0]);
    const { useCreatePlan } = await import("../hooks/usePlans");
    const { result } = renderHook(() => useCreatePlan(), { wrapper: Wrapper });
    await result.current.mutateAsync({ name: "New Plan" });
    expect(mockCreate).toHaveBeenCalledWith({ name: "New Plan" });
  });

  it("useUpdatePlan updates a plan", async () => {
    mockUpdate.mockResolvedValue(mockPlans[0]);
    const { useUpdatePlan } = await import("../hooks/usePlans");
    const { result } = renderHook(() => useUpdatePlan(), { wrapper: Wrapper });
    await result.current.mutateAsync({ id: "p1", data: { name: "Updated" } });
    expect(mockUpdate).toHaveBeenCalledWith("p1", { name: "Updated" });
  });

  it("useSoftDeletePlan sets is_deleted to true", async () => {
    mockUpdate.mockResolvedValue(mockPlans[0]);
    const { useSoftDeletePlan } = await import("../hooks/usePlans");
    const { result } = renderHook(() => useSoftDeletePlan(), { wrapper: Wrapper });
    await result.current.mutateAsync("p1");
    expect(mockUpdate).toHaveBeenCalledWith("p1", { is_deleted: true });
  });

  it("usePermanentDeletePlan deletes the plan", async () => {
    mockDelete.mockResolvedValue(true);
    const { usePermanentDeletePlan } = await import("../hooks/usePlans");
    const { result } = renderHook(() => usePermanentDeletePlan(), { wrapper: Wrapper });
    await result.current.mutateAsync("p1");
    expect(mockDelete).toHaveBeenCalledWith("p1");
  });
});
