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

const mockDepartments = [
  { id: "d1", code: "IT", name: "Phòng IT", is_counted: true, created: new Date().toISOString(), updated: new Date().toISOString() },
  { id: "d2", code: "HR", name: "Phòng HR", is_counted: true, created: new Date().toISOString(), updated: new Date().toISOString() },
];

describe("useDepartments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("fetches departments list", async () => {
    mockGetFullList.mockResolvedValue(mockDepartments);
    const { useDepartments } = await import("../hooks/useDepartments");
    const { result } = renderHook(() => useDepartments(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockDepartments);
  });

  it("useCreateDepartment creates a department", async () => {
    mockCreate.mockResolvedValue(mockDepartments[0]);
    const { useCreateDepartment } = await import("../hooks/useDepartments");
    const { result } = renderHook(() => useCreateDepartment(), { wrapper: Wrapper });
    await result.current.mutateAsync({ code: "IT", name: "Phòng IT" });
    expect(mockCreate).toHaveBeenCalledWith({ code: "IT", name: "Phòng IT" });
  });

  it("useUpdateDepartment updates a department", async () => {
    mockUpdate.mockResolvedValue(mockDepartments[0]);
    const { useUpdateDepartment } = await import("../hooks/useDepartments");
    const { result } = renderHook(() => useUpdateDepartment(), { wrapper: Wrapper });
    await result.current.mutateAsync({ id: "d1", data: { name: "Updated" } });
    expect(mockUpdate).toHaveBeenCalledWith("d1", { name: "Updated" });
  });

  it("useDeleteDepartment deletes a department", async () => {
    mockDelete.mockResolvedValue(true);
    const { useDeleteDepartment } = await import("../hooks/useDepartments");
    const { result } = renderHook(() => useDeleteDepartment(), { wrapper: Wrapper });
    await result.current.mutateAsync("d1");
    expect(mockDelete).toHaveBeenCalledWith("d1");
  });
});
