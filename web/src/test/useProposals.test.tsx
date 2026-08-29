import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ── Mock PocketBase ───────────────────────────────────────────────────────
const mockGetFullList = vi.fn();

vi.mock("../api/client", () => ({
  pb: {
    collection: vi.fn(() => ({
      getFullList: mockGetFullList,
      getList: vi.fn(),
      getOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
    authStore: { record: { id: "user1" }, isValid: true },
  },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe("useProposalsByTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("fetches proposals for a task", async () => {
    const mockProposals = [
      { id: "p1", task_id: "t1", type: "extension", reason: "Need more time", status: "pending" },
      { id: "p2", task_id: "t1", type: "cancellation", reason: "No longer needed", status: "approved" },
    ];
    mockGetFullList.mockResolvedValue(mockProposals);

    const { useProposalsByTask } = await import("../hooks/useProposals");
    const { result } = renderHook(() => useProposalsByTask("t1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockProposals);
    expect(mockGetFullList).toHaveBeenCalled();
  });

  it("does not fetch when taskId is empty", async () => {
    const { useProposalsByTask } = await import("../hooks/useProposals");
    const { result } = renderHook(() => useProposalsByTask(""), { wrapper: Wrapper });

    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.isFetching).toBe(false);
    expect(mockGetFullList).not.toHaveBeenCalled();
  });

  it("returns empty array when no proposals exist", async () => {
    mockGetFullList.mockResolvedValue([]);

    const { useProposalsByTask } = await import("../hooks/useProposals");
    const { result } = renderHook(() => useProposalsByTask("t1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
